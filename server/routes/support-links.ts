import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  supportTicketLinks,
  TICKET_LINK_TYPES,
  type TicketLinkType,
  type SupportTicketLink,
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { storage } from "../storage";
import { recordAudit } from "../lib/audit";
import { notifyUser } from "../lib/notifications";
import { assertTransition, WorkflowError } from "../lib/ticket-workflow";

interface SupportLinksDeps {
  requireAuth: any;
}

const s = storage as any;

const isStaff = (user: any): boolean => {
  if (!user) return false;
  return (
    user.platformRole === "global_admin" ||
    user.platformRole === "constellation_admin" ||
    user.role === "global_admin" ||
    user.role === "constellation_admin" ||
    user.role === "admin" ||
    user.role === "billing-admin"
  );
};

const isPlatformAdmin = (user: any): boolean =>
  user?.platformRole === "global_admin" ||
  user?.platformRole === "constellation_admin" ||
  user?.role === "global_admin" ||
  user?.role === "constellation_admin";

const linkInputSchema = z.object({
  linkedTicketId: z.string().min(1),
  linkType: z.enum(TICKET_LINK_TYPES),
  note: z.string().max(2000).optional(),
});

/**
 * Inverse of a link type, for asymmetric pairs where the reverse direction
 * uses a different name (blocks ↔ blocked_by, parent_of ↔ child_of). For
 * symmetric types (related_to) and one-way types (duplicate_of) we return
 * null and rely on the list query's `OR ticketId = X OR linkedTicketId = X`
 * clause + `direction` marker to surface the link from both sides.
 */
function inverseLinkType(t: TicketLinkType): TicketLinkType | null {
  switch (t) {
    case "duplicate_of": return null; // canonical points only one way
    case "related_to": return null;   // symmetric; store one row, render via direction
    case "blocks": return "blocked_by";
    case "blocked_by": return "blocks";
    case "parent_of": return "child_of";
    case "child_of": return "parent_of";
  }
}

export function registerSupportLinkRoutes(app: Express, deps: SupportLinksDeps) {
  const { requireAuth } = deps;

  // List links for a ticket — staff only, tenant-scoped.
  app.get("/api/support/tickets/:id/links", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isPlatformAdmin(user) && ticket.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rows = await db
      .select()
      .from(supportTicketLinks)
      .where(or(eq(supportTicketLinks.ticketId, ticket.id), eq(supportTicketLinks.linkedTicketId, ticket.id)))
      .orderBy(desc(supportTicketLinks.createdAt));

    // Collapse symmetric pairs from legacy data: if both A→B and B→A exist
    // with the same linkType (e.g. related_to), keep only the older row so
    // the UI doesn't show duplicate "Related" entries. New writes don't
    // produce these pairs (see inverseLinkType for symmetric types).
    const SYMMETRIC: ReadonlySet<TicketLinkType> = new Set<TicketLinkType>(["related_to"]);
    const seenPairs = new Set<string>();
    const collapsedRows = rows.filter((link) => {
      if (!SYMMETRIC.has(link.linkType as TicketLinkType)) return true;
      const pairKey = [link.ticketId, link.linkedTicketId].sort().join("|") + "|" + link.linkType;
      if (seenPairs.has(pairKey)) return false;
      seenPairs.add(pairKey);
      return true;
    });

    // Hydrate the "other side" of each link with subject + status for the UI.
    // Single batched query instead of N point lookups.
    const otherIds = Array.from(new Set(collapsedRows.flatMap((r) => [r.ticketId, r.linkedTicketId])));
    const otherTickets = await storage.getSupportTicketsByIds(otherIds);
    const ticketMap = new Map(otherTickets.map((t) => [t.id, t]));

    return res.json(
      collapsedRows.map((link) => ({
        ...link,
        // Direction relative to the asked-about ticket so the UI can render
        // "this is a duplicate of #X" vs "Y is a duplicate of this".
        direction: link.ticketId === ticket.id ? "outgoing" : "incoming",
        otherTicket: (() => {
          const otherId = link.ticketId === ticket.id ? link.linkedTicketId : link.ticketId;
          const t = ticketMap.get(otherId);
          if (!t) return null;
          return { id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, status: t.status, priority: t.priority };
        })(),
      })),
    );
  });

  // Create a link. When linkType is "duplicate_of", auto-close the source
  // ticket (if workflow allows) and add a reply pointing at the canonical.
  app.post("/api/support/tickets/:id/links", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isPlatformAdmin(user) && ticket.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = linkInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    const { linkedTicketId, linkType, note } = parsed.data;

    if (linkedTicketId === ticket.id) {
      return res.status(400).json({ error: "A ticket cannot link to itself" });
    }
    const linked = await storage.getSupportTicketById(linkedTicketId);
    if (!linked) return res.status(404).json({ error: "Linked ticket not found" });
    if (linked.tenantId !== ticket.tenantId) {
      return res.status(400).json({ error: "Cross-tenant links are not allowed" });
    }

    // Insert the primary link (idempotent on the unique index).
    const [created] = await db
      .insert(supportTicketLinks)
      .values({ ticketId: ticket.id, linkedTicketId, linkType, createdBy: user.id, note: note || null })
      .onConflictDoNothing()
      .returning();

    // Optionally insert the symmetric inverse (related/blocks/parent pairs).
    const inv = inverseLinkType(linkType);
    if (inv) {
      await db
        .insert(supportTicketLinks)
        .values({ ticketId: linkedTicketId, linkedTicketId: ticket.id, linkType: inv, createdBy: user.id })
        .onConflictDoNothing();
    }

    await recordAudit({
      tenantId: ticket.tenantId,
      actorUserId: user.id,
      actorIp: req.ip || null,
      action: "support_ticket.linked",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber, linkType, linkedTicketId, linkedTicketNumber: linked.ticketNumber },
    });

    let autoClosedNote: string | null = null;

    // Duplicate-of: close the source ticket pointing at the canonical, and
    // add a reply with the canonical ticket number so requester / watchers
    // know where to follow up.
    if (linkType === "duplicate_of" && ticket.status !== "closed" && ticket.status !== "resolved") {
      try {
        assertTransition(ticket.status as any, "resolved");
        await storage.updateSupportTicket(ticket.id, {
          status: "resolved" as any,
          resolvedAt: new Date(),
          resolvedBy: user.id,
        } as any);
        const replyMsg = `Marked as duplicate of ticket #${linked.ticketNumber} ("${linked.subject}"). Follow that ticket for updates.`;
        await storage.createSupportTicketReply({
          ticketId: ticket.id,
          userId: user.id,
          message: replyMsg,
          isInternal: false,
          source: "web",
        } as any);
        await s.logSupportTicketActivity?.({
          ticketId: ticket.id,
          actorUserId: user.id,
          action: "status_changed",
          fieldName: "status",
          oldValue: ticket.status,
          newValue: "resolved",
          note: `duplicate_of #${linked.ticketNumber}`,
        });
        await recordAudit({
          tenantId: ticket.tenantId,
          actorUserId: user.id,
          actorIp: req.ip || null,
          action: "support_ticket.status_changed",
          resourceType: "support_ticket",
          resourceId: ticket.id,
          fieldName: "status",
          oldValue: ticket.status,
          newValue: "resolved",
          metadata: { ticketNumber: ticket.ticketNumber, reason: "duplicate_of", canonicalTicketNumber: linked.ticketNumber },
        });
        if (ticket.userId && ticket.userId !== user.id) {
          await notifyUser(ticket.userId, {
            type: "ticket_status_changed",
            title: `Ticket #${ticket.ticketNumber} marked as duplicate of #${linked.ticketNumber}`,
            body: linked.subject,
            linkUrl: `/support?ticketId=${linked.id}`,
            resourceType: "support_ticket",
            resourceId: ticket.id,
            tenantId: ticket.tenantId,
          });
        }
        autoClosedNote = `Closed as duplicate of #${linked.ticketNumber}`;
      } catch (e) {
        if (e instanceof WorkflowError) {
          autoClosedNote = `Link recorded but auto-close skipped: ${e.message}`;
        } else {
          throw e;
        }
      }
    }

    return res.status(created ? 201 : 200).json({
      created: created || null,
      note: autoClosedNote,
    });
  });

  // Remove a link. The inverse link (if any) is removed in the same call.
  app.delete("/api/support/tickets/:id/links/:linkId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaff(user)) return res.status(403).json({ error: "Forbidden" });

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isPlatformAdmin(user) && ticket.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [link] = await db
      .select()
      .from(supportTicketLinks)
      .where(eq(supportTicketLinks.id, req.params.linkId));
    if (!link) return res.status(404).json({ error: "Link not found" });
    if (link.ticketId !== ticket.id && link.linkedTicketId !== ticket.id) {
      return res.status(403).json({ error: "Link does not belong to this ticket" });
    }

    await db.delete(supportTicketLinks).where(eq(supportTicketLinks.id, link.id));
    // Remove the symmetric inverse if present.
    const inv = inverseLinkType(link.linkType as TicketLinkType);
    if (inv) {
      await db
        .delete(supportTicketLinks)
        .where(
          and(
            eq(supportTicketLinks.ticketId, link.linkedTicketId),
            eq(supportTicketLinks.linkedTicketId, link.ticketId),
            eq(supportTicketLinks.linkType, inv),
          ),
        );
    }

    await recordAudit({
      tenantId: ticket.tenantId,
      actorUserId: user.id,
      actorIp: req.ip || null,
      action: "support_ticket.unlinked",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      metadata: { linkId: link.id, linkType: link.linkType, linkedTicketId: link.linkedTicketId },
    });
    return res.status(204).end();
  });
}
