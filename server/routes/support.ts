import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { supportEmailStorage } from "../storage/support-email-types";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "@shared/schema";
import type { InsertSupportTicketReply, SupportTicketReply, SupportTicketWatcher, SupportQueue, SupportTicket } from "@shared/schema";
import { escapeHtml } from "../lib/html-escape";
import { recordAudit } from "../lib/audit";
import { notifyUser } from "../lib/notifications";

const s = storage as any;

interface SupportRouteDeps {
  requireAuth: any;
  requireRole: (roles: string[]) => any;
}

const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  ticketType: z.enum(TICKET_TYPES).optional(),
  queueId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const createReplySchema = z.object({
  message: z.string().min(1),
  isInternal: z.boolean().optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedTo: z.string().nullable().optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  subject: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  queueId: z.string().nullable().optional(),
  ticketType: z.enum(TICKET_TYPES).optional(),
});

const isPalomarAdmin = (role: string): boolean => {
  return ['admin', 'billing-admin'].includes(role) || role === 'constellation_admin' || role === 'global_admin';
};

const isPlatformAdminUser = (user: any): boolean => {
  return user?.platformRole === 'global_admin'
    || user?.platformRole === 'constellation_admin'
    || user?.role === 'global_admin'
    || user?.role === 'constellation_admin';
};

const isStaff = (user: any): boolean => {
  return isPlatformAdminUser(user) || user?.role === 'admin' || user?.role === 'billing-admin';
};

const canStaffAccessTicket = (user: any, ticket: SupportTicket): boolean => {
  if (isPlatformAdminUser(user)) return true;
  return !!user?.tenantId && ticket.tenantId === user.tenantId;
};

function decorateTicketBreachInfo<T extends {
  firstResponseDueAt?: Date | string | null;
  firstResponseAt?: Date | string | null;
  resolutionDueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  slaBreached?: boolean | null;
  status?: string | null;
}>(ticket: T): T & { breachInMinutes: number | null; breachType: 'first_response' | 'resolution' | null } {
  const now = Date.now();
  let best: { mins: number; type: 'first_response' | 'resolution' } | null = null;
  const closed = ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'cancelled';
  if (!closed) {
    if (ticket.firstResponseDueAt && !ticket.firstResponseAt) {
      const mins = Math.floor((new Date(ticket.firstResponseDueAt).getTime() - now) / 60_000);
      if (mins >= 0 && mins <= 60) best = { mins, type: 'first_response' };
    }
    if (ticket.resolutionDueAt && !ticket.resolvedAt) {
      const mins = Math.floor((new Date(ticket.resolutionDueAt).getTime() - now) / 60_000);
      if (mins >= 0 && mins <= 60 && (best === null || mins < best.mins)) best = { mins, type: 'resolution' };
    }
  }
  return {
    ...ticket,
    breachInMinutes: best?.mins ?? null,
    breachType: best?.type ?? null,
  };
}


export function registerSupportRoutes(app: Express, deps: SupportRouteDeps) {
  const { requireAuth, requireRole } = deps;

  app.post("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }

      const { category, subject, description, priority, ticketType, queueId, metadata } = parsed.data;
      const tenantId = (req as any).tenantId || user.tenantId;
      const portalToken = crypto.randomBytes(24).toString("hex");

      const ticket = await storage.createSupportTicket({
        tenantId,
        userId: user.id,
        category,
        subject,
        description,
        priority,
        metadata: metadata || null,
        applicationSource: 'Palomar',
        ticketType: ticketType || 'incident',
        source: 'web',
        queueId: queueId || null,
        portalToken,
        status: 'new',
      } as any);

      // Apply SLA
      try {
        const policy = await s.findMatchingSlaPolicy(tenantId, priority, ticketType || 'incident');
        if (policy) {
          const now = new Date();
          await s.updateSupportTicket(ticket.id, {
            slaPolicyId: policy.id,
            firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMinutes * 60_000) as any,
            resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000) as any,
          });
        }
      } catch (e) { /* non-fatal */ }
      try { await s.logSupportTicketActivity({ ticketId: ticket.id, actorUserId: user.id, action: 'created' }); } catch {}

      // Immutable audit trail for ticket creation.
      await recordAudit({
        tenantId,
        actorUserId: user.id,
        actorIp: req.ip || null,
        action: 'support_ticket.created',
        resourceType: 'support_ticket',
        resourceId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          priority: ticket.priority,
          queueId: ticket.queueId,
          source: ticket.source,
        },
      });

      try {
        const { autoAssignTicketToQueueMember } = await import("../services/support-auto-assign");
        const assignedUserId = await autoAssignTicketToQueueMember(ticket.id, { actorUserId: user.id });
        if (assignedUserId && assignedUserId !== user.id) {
          await notifyUser(assignedUserId, {
            type: 'ticket_assigned',
            title: `Ticket #${ticket.ticketNumber} assigned to you`,
            body: ticket.subject,
            linkUrl: `/support?ticketId=${ticket.id}`,
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            tenantId,
          });
          await recordAudit({
            tenantId,
            actorLabel: 'system:auto-assign',
            action: 'support_ticket.assigned',
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            fieldName: 'assignedTo',
            oldValue: null,
            newValue: assignedUserId,
            metadata: { ticketNumber: ticket.ticketNumber, via: 'queue_round_robin' },
          });
        }
      } catch {}

      try {
        const { sendSupportTicketNotification, sendTicketConfirmationToSubmitter } = await import("../email-support");
        await sendSupportTicketNotification(ticket, user);
        await sendTicketConfirmationToSubmitter(ticket, user);
      } catch (emailErr) {
        console.error("Failed to send ticket notification email:", emailErr);
      }

      try {
        if (tenantId) {
          const tenant = await storage.getTenant(tenantId);
          if (tenant?.supportPlannerEnabled && tenant.supportPlannerPlanId) {
            const { plannerService } = await import("../services/planner-service.js");
            if (plannerService.isAppConfigured()) {
              const bucketName = tenant.supportPlannerBucketName || 'Support Tickets';
              const bucket = await plannerService.getOrCreateBucket(tenant.supportPlannerPlanId, bucketName);
              
              const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';
              const ticketUrl = `${APP_URL}/support`;
              
              const taskTitle = `[#${ticket.ticketNumber}] ${ticket.subject}`;
              const taskDescription = `Priority: ${ticket.priority}\nCategory: ${ticket.category.replace('_', ' ')}\nRequester: ${user.firstName || ''} ${user.lastName || ''} (${user.email})\n\n${ticket.description}\n\nView in Palomar: ${ticketUrl}`;
              
              const plannerTask = await plannerService.createTask({
                planId: tenant.supportPlannerPlanId,
                bucketId: bucket.id,
                title: taskTitle,
              });

              try {
                const taskDetails = await plannerService.getTaskDetails(plannerTask.id);
                if (taskDetails?.['@odata.etag']) {
                  await plannerService.updateTaskDetails(plannerTask.id, taskDetails['@odata.etag'], taskDescription);
                }
              } catch (detailsErr) {
                console.warn('[SUPPORT-PLANNER] Failed to set task details:', detailsErr);
              }

              await storage.createSupportTicketPlannerSync({
                ticketId: ticket.id,
                tenantId,
                planId: tenant.supportPlannerPlanId,
                taskId: plannerTask.id,
                taskTitle: taskTitle,
                bucketId: bucket.id,
                bucketName: bucketName,
                syncStatus: 'synced',
                remoteEtag: plannerTask['@odata.etag'] || null,
                lastSyncedAt: new Date(),
              });
              console.log(`[SUPPORT-PLANNER] Synced ticket #${ticket.ticketNumber} to Planner task ${plannerTask.id}`);
            }
          }
        }
      } catch (plannerErr) {
        console.error('[SUPPORT-PLANNER] Failed to sync ticket to Planner:', plannerErr);
      }

      return res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating support ticket:", error);
      return res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  app.get("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      if (isStaff(user)) {
        const { status, priority, category, tenantId, includeInProgress, view, assignedTo, queueId, ticketType, search, breachingWithinHours } = req.query as Record<string, string | undefined>;
        const isPlatformRole = isPlatformAdminUser(user);
        const effectiveTenantId = isPlatformRole
          ? (tenantId || user.tenantId || undefined)
          : user.tenantId;

        let statusFilter: string | string[] | undefined = includeInProgress === 'true' && status === 'open'
          ? ['open', 'in_progress']
          : (status || undefined);
        let assignedToFilter: string | undefined = assignedTo && assignedTo !== 'unassigned' && assignedTo !== 'me' ? assignedTo : undefined;
        if (assignedTo === 'me') assignedToFilter = user.id;
        let unassigned = assignedTo === 'unassigned';
        let breachingBefore: Date | undefined;
        let breachingAfter: Date | undefined;
        let closedSince: Date | undefined;
        let queueIdsFilter: string[] | undefined;

        switch (view) {
          case 'my-open':
            assignedToFilter = user.id;
            statusFilter = ['new', 'open', 'in_progress'];
            break;
          case 'unassigned':
            unassigned = true;
            statusFilter = ['new', 'open', 'in_progress'];
            break;
          case 'breaching': {
            const hours = parseInt(breachingWithinHours || '1', 10);
            breachingAfter = new Date();
            breachingBefore = new Date(Date.now() + hours * 60 * 60 * 1000);
            statusFilter = ['new', 'open', 'in_progress', 'pending', 'on_hold'];
            break;
          }
          case 'my-queues': {
            statusFilter = ['new', 'open', 'in_progress', 'pending', 'on_hold'];
            // Real queue-membership semantics: queues where the user is the
            // queue lead (defaultAssigneeId).
            const tenantForQueues = isPlatformRole
              ? (effectiveTenantId || user.tenantId)
              : user.tenantId;
            if (tenantForQueues) {
              const queues: SupportQueue[] = await s.getSupportQueues(tenantForQueues);
              queueIdsFilter = queues
                .filter((q) => q.defaultAssigneeId === user.id)
                .map((q) => q.id);
            } else {
              queueIdsFilter = [];
            }
            break;
          }
          case 'awaiting':
            statusFilter = ['pending', 'on_hold'];
            break;
          case 'closed-today': {
            statusFilter = ['resolved', 'closed'];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            closedSince = today;
            break;
          }
        }

        const tickets = await storage.getAllSupportTickets({
          status: statusFilter,
          priority: priority || undefined,
          category: category || undefined,
          tenantId: effectiveTenantId,
          assignedTo: assignedToFilter,
          unassigned,
          queueId: queueId || undefined,
          queueIds: queueIdsFilter,
          ticketType: ticketType || undefined,
          search: search || undefined,
          breachingBefore,
          breachingAfter,
          closedSince,
        });
        return res.json(tickets.map(decorateTicketBreachInfo));
      }

      const tickets = await storage.getSupportTicketsByUserId(user.id);
      return res.json(tickets.map(decorateTicketBreachInfo));
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      return res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });

  app.get("/api/support/tickets/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isOwner = ticket.userId === user.id;
      const staff = isStaff(user);
      const isAdmin = staff && canStaffAccessTicket(user, ticket);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const replies = await storage.getSupportTicketReplies(ticket.id, isAdmin);
      const author = ticket.userId ? await storage.getUser(ticket.userId) : null;
      const tenant = ticket.tenantId ? await storage.getTenant(ticket.tenantId) : null;
      const assignee = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;

      const repliesWithUsers = await Promise.all(
        replies.map(async (reply) => {
          const replyUser = await storage.getUser(reply.userId);
          return {
            ...reply,
            user: replyUser ? { id: replyUser.id, firstName: replyUser.firstName, lastName: replyUser.lastName, email: replyUser.email } : null,
          };
        })
      );

      let watchers: any[] = [];
      let activity: any[] = [];
      if (isAdmin) {
        try {
          const rawWatchers = await s.getSupportTicketWatchers(ticket.id);
          watchers = await Promise.all(rawWatchers.map(async (w: any) => {
            const u = w.userId ? await storage.getUser(w.userId) : null;
            return {
              ...w,
              user: u ? { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName } : null,
            };
          }));
          const rawActivity = await s.getSupportTicketActivity(ticket.id);
          activity = await Promise.all(rawActivity.map(async (a: any) => {
            const actor = a.actorUserId ? await storage.getUser(a.actorUserId) : null;
            return {
              ...a,
              actor: actor ? { id: actor.id, firstName: actor.firstName, lastName: actor.lastName, email: actor.email } : null,
            };
          }));
        } catch (e) { /* non-fatal */ }
      }

      return res.json({
        ...ticket,
        replies: repliesWithUsers,
        author: author ? { id: author.id, email: author.email, firstName: author.firstName, lastName: author.lastName } : null,
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
        assignee: assignee ? { id: assignee.id, email: assignee.email, firstName: assignee.firstName, lastName: assignee.lastName } : null,
        watchers,
        activity,
      });
    } catch (error) {
      console.error("Error fetching support ticket:", error);
      return res.status(500).json({ error: "Failed to fetch support ticket" });
    }
  });

  app.post("/api/support/tickets/:id/replies", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const parsed = createReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }

      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isOwner = ticket.userId === user.id;
      const staff = isStaff(user);
      const isAdmin = staff && canStaffAccessTicket(user, ticket);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { message, isInternal } = parsed.data;

      const willBeInternal = isAdmin && isInternal ? true : false;
      const replyInput: InsertSupportTicketReply = {
        ticketId: ticket.id,
        userId: user.id,
        message,
        isInternal: willBeInternal,
        source: "web",
      };
      const reply: SupportTicketReply = await storage.createSupportTicketReply(replyInput);

      // Activity log: distinguish public reply vs internal note
      try {
        await s.logSupportTicketActivity({
          ticketId: ticket.id,
          actorUserId: user.id,
          action: willBeInternal ? 'internal_note_added' : 'comment_added',
        });
      } catch {}

      // Immutable audit trail entry — distinct from the timeline activity row
      // so that future log mutations to support_ticket_activity (e.g. cleanup
      // utilities) can't quietly rewrite history.
      await recordAudit({
        tenantId: ticket.tenantId,
        actorUserId: user.id,
        actorIp: req.ip || null,
        action: willBeInternal ? 'support_ticket.internal_note_added' : 'support_ticket.reply_added',
        resourceType: 'support_ticket',
        resourceId: ticket.id,
        metadata: { replyId: reply.id, ticketNumber: ticket.ticketNumber },
      });

      // In-app notifications for non-internal replies: notify the requester
      // (if a Palomar user), the assignee (if different), and any watcher
      // user (not external email — those get email separately).
      if (!willBeInternal) {
        const recipientIds = new Set<string>();
        if (ticket.userId && ticket.userId !== user.id) recipientIds.add(ticket.userId);
        if (ticket.assignedTo && ticket.assignedTo !== user.id) recipientIds.add(ticket.assignedTo);
        try {
          const watcherRows = await s.getSupportTicketWatchers(ticket.id);
          for (const w of watcherRows) {
            if (w.userId && w.userId !== user.id) recipientIds.add(w.userId);
          }
        } catch { /* non-fatal */ }
        if (recipientIds.size > 0) {
          const replierName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Support';
          await Promise.all(Array.from(recipientIds).map((uid) =>
            notifyUser(uid, {
              type: 'ticket_new_reply',
              title: `New reply on ticket #${ticket.ticketNumber}`,
              body: `${replierName} replied: ${(message || '').slice(0, 140)}`,
              linkUrl: `/support?ticketId=${ticket.id}`,
              resourceType: 'support_ticket',
              resourceId: ticket.id,
              tenantId: ticket.tenantId,
            })
          ));
        }
      }

      // Mark first response time when an admin posts the first public reply
      if (isAdmin && !willBeInternal && !ticket.firstResponseAt) {
        try {
          await storage.updateSupportTicket(ticket.id, { firstResponseAt: new Date() });
        } catch {}
      }

      // Outbound email pipeline: when an agent posts a non-internal reply, email
      // the requester (and watchers) with proper RFC 5322 threading headers and
      // a per-ticket Reply-To that loops back to the inbound webhook.
      if (!willBeInternal && isAdmin) {
        try {
          const requesterEmail = ticket.externalRequesterEmail
            || (ticket.userId ? (await storage.getUser(ticket.userId))?.email : null);
          if (requesterEmail) {
            const priorReplies: SupportTicketReply[] = await supportEmailStorage.getSupportTicketRepliesWithMessageIds(ticket.id);
            const priorMessageIds = priorReplies.map(r => r.messageId).filter((m): m is string => !!m);
            const watchers: SupportTicketWatcher[] = await supportEmailStorage.getSupportTicketWatchers(ticket.id);
            const ccEmails = watchers
              .map(w => w.externalEmail)
              .filter((e): e is string => typeof e === "string" && !!e && e.toLowerCase() !== requesterEmail.toLowerCase());
            const tenant = ticket.tenantId ? await storage.getTenant(ticket.tenantId) : null;
            const staffName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || "Support";
            const { sendStaffReplyEmail } = await import("../email-support");
            const sentMessageId = await sendStaffReplyEmail({
              ticket,
              reply,
              staffName,
              requesterEmail,
              ccEmails,
              priorMessageIds,
              tenantName: tenant?.name || null,
              fromEmail: tenant?.supportFromEmail || null,
              fromName: tenant?.supportFromName || null,
              replyDomain: tenant?.supportReplyDomain || null,
            });
            if (sentMessageId) {
              await supportEmailStorage.updateSupportTicketReply(reply.id, { messageId: sentMessageId });
              reply.messageId = sentMessageId;
            }
            await supportEmailStorage.logSupportTicketActivity({ ticketId: ticket.id, actorUserId: user.id, action: "comment_added", note: "emailed requester" });
          }
        } catch (mailErr) {
          console.error("[SUPPORT] Failed to email staff reply:", mailErr);
        }
      }

      return res.status(201).json(reply);
    } catch (error) {
      console.error("Error creating ticket reply:", error);
      return res.status(500).json({ error: "Failed to create ticket reply" });
    }
  });

  app.patch("/api/support/tickets/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Authentication required" });

      const parsed = updateTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }

      const ticket = await storage.getSupportTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isOwner = ticket.userId === user.id;
      const staff = isStaff(user);
      const isAdmin = staff && canStaffAccessTicket(user, ticket);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updates: any = { ...parsed.data };

      if (isOwner && !isAdmin) {
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          return res.status(400).json({ error: "Cannot edit a resolved or closed ticket" });
        }
        const allowedOwnerFields = ['subject', 'description', 'priority', 'category', 'status'];
        for (const key of Object.keys(updates)) {
          if (!allowedOwnerFields.includes(key)) {
            delete updates[key];
          }
        }
        if (updates.status && updates.status !== 'closed') {
          return res.status(400).json({ error: "You can only close your own ticket" });
        }
      }

      const wasResolved = ticket.status === 'resolved';

      if (updates.status === "resolved") {
        updates.resolvedAt = new Date();
        updates.resolvedBy = user.id;
      }

      const updated = await storage.updateSupportTicket(ticket.id, updates);

      // Log activity rows for each tracked field change + write parallel
      // immutable audit entries, and dispatch notifications for the events
      // that humans should know about (reassignment, status change).
      try {
        const trackedFields = [
          'status', 'priority', 'assignedTo', 'queueId', 'ticketType', 'category',
        ] as const;
        type TrackedField = typeof trackedFields[number];
        const fieldFromTicket = (t: typeof ticket, f: TrackedField): string | null => {
          const v = t[f];
          return v == null ? null : String(v);
        };
        const fieldFromUpdates = (u: typeof updates, f: TrackedField): string | null | undefined => {
          if (!(f in u)) return undefined;
          const v = u[f];
          return v == null ? null : String(v);
        };
        for (const field of trackedFields) {
          const newVal = fieldFromUpdates(updates, field);
          if (newVal === undefined) continue;
          const oldVal = fieldFromTicket(ticket, field);
          if ((oldVal ?? '') !== (newVal ?? '')) {
            await s.logSupportTicketActivity({
              ticketId: ticket.id,
              actorUserId: user.id,
              action: field === 'assignedTo' ? 'assigned' : `${field}_changed`,
              fieldName: field,
              oldValue: oldVal,
              newValue: newVal,
            });
            await recordAudit({
              tenantId: ticket.tenantId,
              actorUserId: user.id,
              actorIp: req.ip || null,
              action: field === 'assignedTo' ? 'support_ticket.assigned' : `support_ticket.${field}_changed`,
              resourceType: 'support_ticket',
              resourceId: ticket.id,
              fieldName: field,
              oldValue: oldVal,
              newValue: newVal,
              metadata: { ticketNumber: ticket.ticketNumber },
            });

            // Targeted notifications:
            if (field === 'assignedTo' && newVal && newVal !== user.id) {
              await notifyUser(newVal, {
                type: 'ticket_assigned',
                title: `Ticket #${ticket.ticketNumber} assigned to you`,
                body: ticket.subject,
                linkUrl: `/support?ticketId=${ticket.id}`,
                resourceType: 'support_ticket',
                resourceId: ticket.id,
                tenantId: ticket.tenantId,
              });
            }
            if (field === 'status' && ticket.userId && ticket.userId !== user.id) {
              await notifyUser(ticket.userId, {
                type: 'ticket_status_changed',
                title: `Ticket #${ticket.ticketNumber} is now ${newVal}`,
                body: ticket.subject,
                linkUrl: `/support?ticketId=${ticket.id}`,
                resourceType: 'support_ticket',
                resourceId: ticket.id,
                tenantId: ticket.tenantId,
              });
            }
          }
        }
      } catch (e) { /* non-fatal */ }

      const isBeingClosed = (updates.status === "resolved" || updates.status === "closed") 
        && ticket.status !== 'resolved' && ticket.status !== 'closed';
      
      if (isBeingClosed) {
        const closedByOwner = isOwner && !isAdmin;
        
        if (closedByOwner) {
          try {
            const { sendSupportTicketNotification } = await import("../email-support");
            const ownerUser = await storage.getUser(ticket.userId);
            if (ownerUser) {
              const { getUncachableSendGridClient } = await import("../services/sendgrid-client");
              const { client: sgClient, fromEmail } = await getUncachableSendGridClient();
              const submitterName = `${ownerUser.firstName || ''} ${ownerUser.lastName || ''}`.trim() || ownerUser.email;
              await sgClient.send({
                to: "Palomar@synozur.com",
                from: fromEmail,
                subject: `[Palomar Support] Ticket #${ticket.ticketNumber} closed by submitter`,
                html: `<p>Ticket #${ticket.ticketNumber} "<strong>${escapeHtml(ticket.subject)}</strong>" was closed by the submitter: ${escapeHtml(submitterName)} (${escapeHtml(ownerUser.email)}).</p>`,
              });
              console.log(`[SUPPORT] Notified support team that ticket #${ticket.ticketNumber} was closed by submitter`);
            }
          } catch (emailErr) {
            console.error('[SUPPORT] Failed to send owner-closure notification:', emailErr);
          }
        } else {
          try {
            const requester = await storage.getUser(ticket.userId);
            if (requester?.email) {
              const { emailService } = await import("../services/email-notification.js");
              const tenant = ticket.tenantId ? await storage.getTenant(ticket.tenantId) : null;
              const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';
              const branding = tenant ? { companyName: tenant.name, emailHeaderUrl: tenant.emailHeaderUrl } : undefined;
              await emailService.notifySupportTicketClosed(
                { email: requester.email, name: `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.email },
                ticket.ticketNumber,
                ticket.subject,
                undefined,
                branding,
                `${APP_URL}/support`
              );
              console.log(`[SUPPORT] Sent closure email to ${requester.email} for ticket #${ticket.ticketNumber}`);
            }
          } catch (emailErr) {
            console.error('[SUPPORT] Failed to send closure email:', emailErr);
          }
        }

        try {
          const syncRecord = await storage.getSupportTicketPlannerSyncByTicketId(ticket.id);
          if (syncRecord) {
            const { plannerService } = await import("../services/planner-service.js");
            if (plannerService.isAppConfigured()) {
              const taskDetails = await plannerService.getTaskWithDetails(syncRecord.taskId);
              const etag = taskDetails?.['@odata.etag'];
              if (etag) {
                await plannerService.updateTask(syncRecord.taskId, etag, { percentComplete: 100 });
                await storage.updateSupportTicketPlannerSync(syncRecord.id, { syncStatus: 'synced' });
                console.log(`[SUPPORT-PLANNER] Marked Planner task ${syncRecord.taskId} as complete for ticket #${ticket.ticketNumber}`);
              }
            }
          }
        } catch (plannerErr) {
          console.error('[SUPPORT-PLANNER] Failed to mark Planner task as complete:', plannerErr);
        }
      }

      return res.json(updated);
    } catch (error) {
      console.error("Error updating support ticket:", error);
      return res.status(500).json({ error: "Failed to update support ticket" });
    }
  });

  app.get("/api/tenants/:tenantId/support-integrations", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const userTenantId = (req as any).user?.tenantId;
      if (userTenantId && userTenantId !== tenant.id) {
        const platformRole = (req as any).user?.platformRole;
        if (platformRole !== 'global_admin' && platformRole !== 'constellation_admin') {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      return res.json({
        supportPlannerEnabled: tenant.supportPlannerEnabled || false,
        supportPlannerPlanId: tenant.supportPlannerPlanId,
        supportPlannerPlanTitle: tenant.supportPlannerPlanTitle,
        supportPlannerPlanWebUrl: tenant.supportPlannerPlanWebUrl,
        supportPlannerGroupId: tenant.supportPlannerGroupId,
        supportPlannerGroupName: tenant.supportPlannerGroupName,
        supportPlannerBucketName: tenant.supportPlannerBucketName || 'Support Tickets',
        supportListsEnabled: tenant.supportListsEnabled || false,
        connectorPlanner: tenant.connectorPlanner || false,
      });
    } catch (error) {
      console.error("Error fetching support integrations:", error);
      return res.status(500).json({ error: "Failed to fetch support integrations" });
    }
  });

  app.patch("/api/tenants/:tenantId/support-integrations", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const userTenantId = (req as any).user?.tenantId;
      if (userTenantId && userTenantId !== tenant.id) {
        const platformRole = (req as any).user?.platformRole;
        if (platformRole !== 'global_admin' && platformRole !== 'constellation_admin') {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const updateSchema = z.object({
        supportPlannerEnabled: z.boolean().optional(),
        supportPlannerPlanId: z.string().nullable().optional(),
        supportPlannerPlanTitle: z.string().nullable().optional(),
        supportPlannerPlanWebUrl: z.string().nullable().optional(),
        supportPlannerGroupId: z.string().nullable().optional(),
        supportPlannerGroupName: z.string().nullable().optional(),
        supportPlannerBucketName: z.string().nullable().optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }

      const updated = await storage.updateTenant(tenant.id, parsed.data as any);
      return res.json({
        supportPlannerEnabled: updated.supportPlannerEnabled || false,
        supportPlannerPlanId: updated.supportPlannerPlanId,
        supportPlannerPlanTitle: updated.supportPlannerPlanTitle,
        supportPlannerPlanWebUrl: updated.supportPlannerPlanWebUrl,
        supportPlannerGroupId: updated.supportPlannerGroupId,
        supportPlannerGroupName: updated.supportPlannerGroupName,
        supportPlannerBucketName: updated.supportPlannerBucketName || 'Support Tickets',
        supportListsEnabled: updated.supportListsEnabled || false,
      });
    } catch (error) {
      console.error("Error updating support integrations:", error);
      return res.status(500).json({ error: "Failed to update support integrations" });
    }
  });

  app.post("/api/tenants/:tenantId/support-integrations/sync-existing", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const userTenantId = (req as any).user?.tenantId;
      if (userTenantId && userTenantId !== tenant.id) {
        const platformRole = (req as any).user?.platformRole;
        if (platformRole !== 'global_admin' && platformRole !== 'constellation_admin') {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      if (!tenant.supportPlannerEnabled || !tenant.supportPlannerPlanId) {
        return res.status(400).json({ error: "Planner integration is not configured for this tenant" });
      }

      const { plannerService } = await import("../services/planner-service.js");
      if (!plannerService.isAppConfigured()) {
        return res.status(500).json({ error: "Planner service is not configured" });
      }

      const openTickets = await storage.getSupportTicketsByTenantId(tenant.id, 'open');
      const inProgressTickets = await storage.getSupportTicketsByTenantId(tenant.id, 'in_progress');
      const allUnresolvedTickets = [...openTickets, ...inProgressTickets];

      const existingSyncs = await storage.getSupportTicketPlannerSyncsByTenant(tenant.id);
      const syncedTicketIds = new Set(existingSyncs.map(s => s.ticketId));
      const unsyncedTickets = allUnresolvedTickets.filter(t => !syncedTicketIds.has(t.id));

      if (unsyncedTickets.length === 0) {
        return res.json({ synced: 0, errors: 0, message: "All open tickets are already synced to Planner" });
      }

      const bucketName = tenant.supportPlannerBucketName || 'Support Tickets';
      const bucket = await plannerService.getOrCreateBucket(tenant.supportPlannerPlanId, bucketName);
      const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';
      const ticketUrl = `${APP_URL}/support`;

      let synced = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const ticket of unsyncedTickets) {
        try {
          const requester = await storage.getUser(ticket.userId);
          const requesterName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.email : 'Unknown';
          const requesterEmail = requester?.email || 'unknown';

          const taskTitle = `[#${ticket.ticketNumber}] ${ticket.subject}`;
          const taskDescription = `Priority: ${ticket.priority}\nCategory: ${ticket.category.replace('_', ' ')}\nRequester: ${requesterName} (${requesterEmail})\n\n${ticket.description}\n\nView in Palomar: ${ticketUrl}`;

          const plannerTask = await plannerService.createTask({
            planId: tenant.supportPlannerPlanId,
            bucketId: bucket.id,
            title: taskTitle,
          });

          try {
            const taskDetails = await plannerService.getTaskDetails(plannerTask.id);
            if (taskDetails?.['@odata.etag']) {
              await plannerService.updateTaskDetails(plannerTask.id, taskDetails['@odata.etag'], taskDescription);
            }
          } catch (detailsErr) {
            console.warn('[SUPPORT-PLANNER-SYNC-EXISTING] Failed to set task details:', detailsErr);
          }

          await storage.createSupportTicketPlannerSync({
            ticketId: ticket.id,
            tenantId: tenant.id,
            planId: tenant.supportPlannerPlanId,
            taskId: plannerTask.id,
            taskTitle: taskTitle,
            bucketId: bucket.id,
            bucketName: bucketName,
            syncStatus: 'synced',
            remoteEtag: plannerTask['@odata.etag'] || null,
            lastSyncedAt: new Date(),
          });

          synced++;
          console.log(`[SUPPORT-PLANNER-SYNC-EXISTING] Synced ticket #${ticket.ticketNumber} to Planner`);
        } catch (ticketErr: any) {
          errors++;
          errorDetails.push(`Ticket #${ticket.ticketNumber}: ${ticketErr.message}`);
          console.error(`[SUPPORT-PLANNER-SYNC-EXISTING] Failed to sync ticket #${ticket.ticketNumber}:`, ticketErr.message);
        }
      }

      return res.json({
        synced,
        errors,
        total: unsyncedTickets.length,
        message: `Synced ${synced} of ${unsyncedTickets.length} existing tickets to Planner`,
        ...(errorDetails.length > 0 && { errorDetails }),
      });
    } catch (error: any) {
      console.error("Error syncing existing tickets:", error);
      return res.status(500).json({ error: "Failed to sync existing tickets", message: error?.message });
    }
  });

  // ===== Saved filters (per-user, scoped to user's tenant) =====
  app.get("/api/support/saved-filters", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    const filters = await s.getSupportSavedFilters(user.id, user.tenantId || null);
    return res.json(filters);
  });

  const savedFilterSchema = z.object({
    name: z.string().min(1).max(80),
    query: z.record(z.any()),
    isPinned: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });

  app.post("/api/support/saved-filters", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    const parsed = savedFilterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    // Tenant binding is server-side: never trust the client.
    const created = await s.createSupportSavedFilter({
      userId: user.id,
      tenantId: user.tenantId || null,
      name: parsed.data.name,
      query: parsed.data.query,
      isPinned: parsed.data.isPinned || false,
      sortOrder: parsed.data.sortOrder || 0,
    });
    return res.status(201).json(created);
  });

  app.patch("/api/support/saved-filters/:id", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    const parsed = savedFilterSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    const updated = await s.updateSupportSavedFilter(req.params.id, user.id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  app.delete("/api/support/saved-filters/:id", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    await s.deleteSupportSavedFilter(req.params.id, user.id);
    return res.status(204).end();
  });

  // ===== Full-text search (Postgres tsvector) =====
  app.get("/api/support/search", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json({ tickets: [], replies: [] });
    const isPlatformRole = isPlatformAdminUser(user);
    // Platform admins can pass a tenantId to scope; everyone else is locked to their own tenant.
    const tenantId = isPlatformRole ? ((req.query.tenantId as string) || user.tenantId || null) : user.tenantId || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const [tickets, replies] = await Promise.all([
      s.searchSupportTickets({ tenantId, q, limit }),
      s.searchSupportTicketReplies({ tenantId, q, limit }),
    ]);
    return res.json({ tickets, replies });
  });

  // ===== Analytics (60s cache) =====
  let analyticsCache = new Map<string, { at: number; data: any }>();
  app.get("/api/support/analytics", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });
    const isPlatformRole = isPlatformAdminUser(user);
    const tenantId = isPlatformRole ? ((req.query.tenantId as string) || user.tenantId || null) : user.tenantId || null;
    const key = `t:${tenantId || "__all__"}`;
    const now = Date.now();
    const hit = analyticsCache.get(key);
    if (hit && now - hit.at < 60_000) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "private, max-age=60");
      return res.json(hit.data);
    }
    const data = await s.getSupportAnalytics(tenantId);
    analyticsCache.set(key, { at: now, data });
    // Drop old keys eventually
    if (analyticsCache.size > 200) analyticsCache = new Map();
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.json(data);
  });
}
