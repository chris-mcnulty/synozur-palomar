import { storage } from "../storage";

const s = storage as any;

/**
 * Auto-assigns a freshly created ticket to the least-loaded active member of
 * its queue. When loads are tied, falls back to round-robin (next member after
 * the last-assigned one). Idempotent: skips if the ticket has no queue, is
 * already assigned, or the queue has no active members.
 *
 * Logs an activity row on success. All errors are swallowed (best-effort).
 */
export async function autoAssignTicketToQueueMember(
  ticketId: string,
  opts?: { actorLabel?: string; actorUserId?: string },
): Promise<string | null> {
  try {
    const t = await s.getSupportTicketById(ticketId);
    if (!t || !t.queueId || t.assignedTo) return null;
    const userId: string | null = await s.getNextQueueAssignee(t.queueId);
    if (!userId) return null;
    await s.updateSupportTicket(t.id, { assignedTo: userId });
    await s.logSupportTicketActivity({
      ticketId: t.id,
      actorUserId: opts?.actorUserId || null,
      actorLabel: opts?.actorLabel || "auto-assign",
      action: "assigned",
      fieldName: "assignedTo",
      oldValue: null,
      newValue: userId,
      note: "auto-assigned via queue routing",
    });
    return userId;
  } catch (err) {
    console.error("[SUPPORT-AUTO-ASSIGN] failed:", err);
    return null;
  }
}
