import * as cron from 'node-cron';
import { storage } from '../storage.js';
import { sendSlaBreachEscalation } from '../email-support.js';
import { recordAudit } from '../lib/audit.js';
import { notifyUsers } from '../lib/notifications.js';
import { withAdvisoryLock } from '../lib/advisory-lock.js';
import { logger, serializeError } from '../lib/logger.js';
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
          await recordAudit({
            tenantId: ticket.tenantId,
            actorLabel: 'system:sla-watcher',
            action: 'support_ticket.sla_breached',
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            fieldName: 'firstResponseDueAt',
            metadata: { breachType: 'first_response', overdueMinutes: overdue, ticketNumber: ticket.ticketNumber },
          });
          // In-app notify assignee + watcher users.
          const watcherUserIds = (await s.getSupportTicketWatchers(ticket.id))
            .map((w) => w.userId).filter((id): id is string => !!id);
          await notifyUsers([ticket.assignedTo, ...watcherUserIds], {
            type: 'ticket_sla_breached',
            title: `SLA breach: ticket #${ticket.ticketNumber} first response overdue`,
            body: `Overdue by ${overdue}m — ${ticket.subject}`,
            linkUrl: `/support?ticketId=${ticket.id}`,
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            tenantId: ticket.tenantId,
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
            await recordAudit({
              tenantId: ticket.tenantId,
              actorLabel: 'system:sla-watcher',
              action: 'support_ticket.priority_bumped',
              resourceType: 'support_ticket',
              resourceId: ticket.id,
              fieldName: 'priority',
              oldValue: ticket.priority,
              newValue: priorityBumpedTo,
              metadata: { reason: 'sla_resolution_breach', ticketNumber: ticket.ticketNumber },
            });
          }

          await recordAudit({
            tenantId: ticket.tenantId,
            actorLabel: 'system:sla-watcher',
            action: 'support_ticket.sla_breached',
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            fieldName: 'resolutionDueAt',
            metadata: { breachType: 'resolution', overdueMinutes: overdue, priorityBumpedTo, ticketNumber: ticket.ticketNumber },
          });

          // In-app notify assignee + watcher users for resolution breach.
          const watcherUserIds = (await s.getSupportTicketWatchers(ticket.id))
            .map((w) => w.userId).filter((id): id is string => !!id);
          await notifyUsers([ticket.assignedTo, ...watcherUserIds], {
            type: 'ticket_sla_breached',
            title: `SLA breach: ticket #${ticket.ticketNumber} resolution overdue`,
            body: `Overdue by ${overdue}m — ${ticket.subject}`,
            linkUrl: `/support?ticketId=${ticket.id}`,
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            tenantId: ticket.tenantId,
          });

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
        logger.error('sla_per_ticket_error', { ticketId: ticket.id, jobRunId: jobRun.id, ...serializeError(perTicketErr) });
      }
    }

    await s.updateScheduledJobRun(jobRun.id, {
      status: result.errors > 0 && result.firstResponseBreaches + result.resolutionBreaches === 0 ? 'failed' : 'completed',
      completedAt: new Date(),
      resultSummary: result,
    });

    if (result.firstResponseBreaches + result.resolutionBreaches > 0) {
      logger.info('sla_run_complete', { jobRunId: jobRun.id, ...result });
    }
    return result;
  } catch (err) {
    logger.error('sla_run_failed', { jobRunId: jobRun.id, ...serializeError(err) });
    const msg = err instanceof Error ? err.message : String(err);
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
let heartbeatTask: cron.ScheduledTask | null = null;

const SLA_LOCK_KEY = 'sla-breach-watcher';
// If the watcher hasn't logged a successful run in this many minutes, alert.
const HEARTBEAT_STALENESS_MIN = 5;

/**
 * Wrap the SLA breach check with a Postgres advisory lock so that if multiple
 * instances of the server are running, only one fires the watcher per tick.
 * Failures to acquire the lock are not errors — they just mean another runner
 * picked up the work.
 */
async function runSlaBreachCheckLocked(): Promise<void> {
  const { acquired } = await withAdvisoryLock(SLA_LOCK_KEY, async () => {
    return runSlaBreachCheck();
  });
  if (!acquired) {
    // Another process is running this tick. That's the design — exit quietly.
    return;
  }
}

let lastStalenessAlertAt = 0;
const STALENESS_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function runHeartbeatCheck(): Promise<void> {
  try {
    const last = await (storage as any).getLastSuccessfulScheduledJobRun?.('sla_breach_watcher');
    if (!last) return; // First-run skip; the runner has yet to record anything.
    const ageMs = Date.now() - new Date(last.startedAt).getTime();
    const ageMin = Math.floor(ageMs / 60_000);
    if (ageMin >= HEARTBEAT_STALENESS_MIN) {
      // Cooldown so we don't spam the log every minute once stale.
      if (Date.now() - lastStalenessAlertAt < STALENESS_ALERT_COOLDOWN_MS) return;
      lastStalenessAlertAt = Date.now();
      console.error(
        `${TAG} STALE: SLA breach watcher hasn't completed successfully in ${ageMin}m (threshold ${HEARTBEAT_STALENESS_MIN}m). ` +
        `Last successful run at ${last.startedAt}. ` +
        `Investigate the scheduler — SLA escalation emails and audit entries are not being emitted.`,
      );
      try {
        const { getUncachableSendGridClient } = await import('../services/sendgrid-client.js');
        const { client, fromEmail } = await getUncachableSendGridClient();
        const adminEmails = await (storage as any).getPlatformAdminEmails?.();
        if (Array.isArray(adminEmails) && adminEmails.length > 0) {
          await client.send({
            to: adminEmails[0],
            bcc: adminEmails.length > 1 ? adminEmails.slice(1) : undefined,
            from: fromEmail,
            subject: `[Palomar] SLA breach watcher is stale (${ageMin}m without a successful run)`,
            html: `<p>The SLA breach watcher has not completed successfully in <strong>${ageMin} minutes</strong>.</p>
                   <p>Last successful run: ${last.startedAt}</p>
                   <p>This means SLA breach emails, in-app notifications, priority bumps, and audit entries are not being emitted. Investigate scheduler health.</p>`,
          });
        }
      } catch (mailErr) {
        const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error(`${TAG} Failed to send staleness alert email: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} Heartbeat check failed: ${msg}`);
  }
}

export async function startSlaBreachScheduler(): Promise<void> {
  if (scheduledTask) {
    console.log(`${TAG} Scheduler already running`);
    return;
  }
  scheduledTask = cron.schedule('* * * * *', async () => {
    try {
      await runSlaBreachCheckLocked();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} Cron tick failed:`, msg);
    }
  });
  // Heartbeat / staleness alert. Runs every 5 minutes; alerts (with 1h
  // cooldown) when no successful SLA run has been recorded within the
  // staleness threshold. Catches the "scheduler silently died" case.
  heartbeatTask = cron.schedule('*/5 * * * *', async () => {
    await runHeartbeatCheck();
  });
  console.log(`${TAG} Scheduler started (every minute) + heartbeat watch (every 5 min)`);
}

export function stopSlaBreachScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (heartbeatTask) {
    heartbeatTask.stop();
    heartbeatTask = null;
  }
  console.log(`${TAG} Scheduler stopped`);
}
