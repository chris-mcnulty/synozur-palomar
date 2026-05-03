import * as cron from 'node-cron';
import { storage } from '../storage.js';
import { sendSlaBreachEscalation } from '../email-support.js';
import {
  TICKET_PRIORITIES,
  type SupportTicket,
  type SupportSlaPolicy,
  type SupportQueue,
  type SupportTicketWatcher,
  type SupportTicketActivity,
  type User,
  type ScheduledJobRun,
} from '@shared/schema';

const TAG = '[SLA-WATCHER]';

const PRIORITY_ORDER: readonly string[] = TICKET_PRIORITIES;

function nextPriority(current: string): string | null {
  const idx = PRIORITY_ORDER.indexOf(current);
  if (idx < 0 || idx >= PRIORITY_ORDER.length - 1) return null;
  return PRIORITY_ORDER[idx + 1];
}

function diffMinutes(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60_000);
}

/**
 * Storage operations needed by the SLA breach watcher. The application's
 * IStorage interface doesn't formally enumerate every support helper, so we
 * narrow the surface here with a typed view rather than reach for `as any`.
 */
interface SlaBreachStorage {
  getSupportTicketsForSlaCheck(now: Date): Promise<SupportTicket[]>;
  getSupportQueueById(id: string): Promise<SupportQueue | undefined>;
  getSupportSlaPolicyById(id: string): Promise<SupportSlaPolicy | undefined>;
  getSupportTicketWatchers(ticketId: string): Promise<SupportTicketWatcher[]>;
  getSupportTicketActivity(ticketId: string): Promise<SupportTicketActivity[]>;
  getUser(id: string): Promise<User | undefined>;
  updateSupportTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket>;
  logSupportTicketActivity(entry: Partial<SupportTicketActivity> & { ticketId: string; action: string }): Promise<SupportTicketActivity>;
  createScheduledJobRun(run: Partial<ScheduledJobRun>): Promise<ScheduledJobRun>;
  updateScheduledJobRun(id: string, updates: Partial<ScheduledJobRun>): Promise<ScheduledJobRun>;
}

const s = storage as unknown as SlaBreachStorage;

async function collectRecipients(
  ticket: SupportTicket,
  queue: SupportQueue | null,
): Promise<string[]> {
  const set = new Set<string>();
  if (queue?.escalationContactEmail) set.add(queue.escalationContactEmail.toLowerCase());

  const watchers = await s.getSupportTicketWatchers(ticket.id);
  for (const w of watchers) {
    if (w.externalEmail) {
      set.add(w.externalEmail.toLowerCase());
    } else if (w.userId) {
      const u = await s.getUser(w.userId);
      if (u?.email) set.add(u.email.toLowerCase());
    }
  }

  return Array.from(set);
}

async function hasPriorBreachActivity(
  ticketId: string,
  fieldName: 'firstResponseDueAt' | 'resolutionDueAt',
): Promise<boolean> {
  const activity = await s.getSupportTicketActivity(ticketId);
  return activity.some((a) => a.action === 'sla_breached' && a.fieldName === fieldName);
}

async function resolveRequesterEmail(ticket: SupportTicket): Promise<string | null> {
  if (ticket.externalRequesterEmail) return ticket.externalRequesterEmail;
  if (ticket.userId) {
    const u = await s.getUser(ticket.userId);
    return u?.email || null;
  }
  return null;
}

export interface SlaBreachRunResult {
  checked: number;
  firstResponseBreaches: number;
  resolutionBreaches: number;
  emailsSent: number;
  errors: number;
}

export async function runSlaBreachCheck(
  triggeredBy: 'scheduled' | 'manual' | 'catchup' = 'scheduled',
  triggeredByUserId?: string,
): Promise<SlaBreachRunResult> {
  const now = new Date();

  const jobRun = await s.createScheduledJobRun({
    tenantId: null,
    jobType: 'sla_breach_watcher',
    status: 'running',
    triggeredBy,
    triggeredByUserId: triggeredByUserId || null,
  });

  const result: SlaBreachRunResult = {
    checked: 0,
    firstResponseBreaches: 0,
    resolutionBreaches: 0,
    emailsSent: 0,
    errors: 0,
  };

  try {
    const tickets = await s.getSupportTicketsForSlaCheck(now);
    result.checked = tickets.length;

    for (const ticket of tickets) {
      try {
        const queue = ticket.queueId ? (await s.getSupportQueueById(ticket.queueId)) || null : null;
        const policy = ticket.slaPolicyId ? (await s.getSupportSlaPolicyById(ticket.slaPolicyId)) || null : null;

        const frDue = ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt) : null;
        const frBreached = !!(frDue && !ticket.firstResponseAt && frDue.getTime() <= now.getTime());

        const resDue = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt) : null;
        const resBreached = !!(resDue && !ticket.resolvedAt && resDue.getTime() <= now.getTime());

        if (!frBreached && !resBreached) continue;

        // Per-breach-type dedupe: scan activity log for an existing
        // 'sla_breached' row tagged to that specific field. The aggregate
        // `slaBreached` flag is set on first breach of either type and stays
        // on for the lifetime of the ticket.
        const [frAlready, resAlready] = await Promise.all([
          frBreached ? hasPriorBreachActivity(ticket.id, 'firstResponseDueAt') : Promise.resolve(false),
          resBreached ? hasPriorBreachActivity(ticket.id, 'resolutionDueAt') : Promise.resolve(false),
        ]);

        const needsAggregateFlag = !ticket.slaBreached && ((frBreached && !frAlready) || (resBreached && !resAlready));
        const recipients = await collectRecipients(ticket, queue);
        const requesterEmail = await resolveRequesterEmail(ticket);

        if (frBreached && !frAlready) {
          result.firstResponseBreaches++;
          const overdue = diffMinutes(now, frDue!);
          await s.logSupportTicketActivity({
            ticketId: ticket.id,
            actorLabel: 'system',
            action: 'sla_breached',
            fieldName: 'firstResponseDueAt',
            note: `First response overdue by ${overdue}m`,
          });
          try {
            await sendSlaBreachEscalation(ticket, recipients, {
              breachType: 'first_response',
              queueName: queue?.name || null,
              requesterEmail,
              overdueMinutes: overdue,
              priorityBumpedTo: null,
            });
            if (recipients.length > 0) result.emailsSent++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`${TAG} email failed for ticket ${ticket.id}:`, msg);
          }
        }

        let priorityBumpedTo: string | null = null;
        const ticketUpdates: Partial<SupportTicket> = {};

        if (resBreached && !resAlready) {
          result.resolutionBreaches++;
          const overdue = diffMinutes(now, resDue!);

          if (policy?.bumpPriorityOnBreach) {
            const next = nextPriority(ticket.priority);
            if (next && next !== ticket.priority) {
              ticketUpdates.priority = next;
              priorityBumpedTo = next;
            }
          }

          await s.logSupportTicketActivity({
            ticketId: ticket.id,
            actorLabel: 'system',
            action: 'sla_breached',
            fieldName: 'resolutionDueAt',
            note: `Resolution overdue by ${overdue}m`,
          });

          if (priorityBumpedTo) {
            await s.logSupportTicketActivity({
              ticketId: ticket.id,
              actorLabel: 'system',
              action: 'priority_bumped',
              fieldName: 'priority',
              oldValue: ticket.priority,
              newValue: priorityBumpedTo,
              note: 'Auto-escalated on SLA resolution breach',
            });
          }

          try {
            await sendSlaBreachEscalation(ticket, recipients, {
              breachType: 'resolution',
              queueName: queue?.name || null,
              requesterEmail,
              overdueMinutes: overdue,
              priorityBumpedTo,
            });
            if (recipients.length > 0) result.emailsSent++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`${TAG} email failed for ticket ${ticket.id}:`, msg);
          }
        }

        if (needsAggregateFlag) ticketUpdates.slaBreached = true;
        if (Object.keys(ticketUpdates).length > 0) {
          await s.updateSupportTicket(ticket.id, ticketUpdates);
        }
      } catch (perTicketErr) {
        result.errors++;
        const msg = perTicketErr instanceof Error ? perTicketErr.message : String(perTicketErr);
        console.error(`${TAG} per-ticket error on ${ticket.id}:`, msg);
      }
    }

    await s.updateScheduledJobRun(jobRun.id, {
      status: result.errors > 0 && result.firstResponseBreaches + result.resolutionBreaches === 0 ? 'failed' : 'completed',
      completedAt: new Date(),
      resultSummary: result,
    });

    if (result.firstResponseBreaches + result.resolutionBreaches > 0) {
      console.log(`${TAG} Run complete:`, result);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} Run failed:`, msg);
    await s.updateScheduledJobRun(jobRun.id, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: msg,
    });
    result.errors++;
    return result;
  }
}

let scheduledTask: cron.ScheduledTask | null = null;

export async function startSlaBreachScheduler(): Promise<void> {
  if (scheduledTask) {
    console.log(`${TAG} Scheduler already running`);
    return;
  }
  scheduledTask = cron.schedule('* * * * *', async () => {
    try {
      await runSlaBreachCheck();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} Cron tick failed:`, msg);
    }
  });
  console.log(`${TAG} Scheduler started (every minute)`);
}

export function stopSlaBreachScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log(`${TAG} Scheduler stopped`);
  }
}
