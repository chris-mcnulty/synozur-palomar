/**
 * Status workflow rules for support tickets. Enforces sensible transitions
 * so high-volume internal queues stay manageable.
 *
 * Allowed transitions encode the help-desk lifecycle: a ticket cannot be
 * moved straight from `new` to `resolved` without ever being touched, and
 * a closed ticket cannot bounce back to active without an explicit reopen
 * (which goes through `open`, not back to `new`).
 */

import type { TicketStatus } from "@shared/schema";

const TRANSITIONS: Record<TicketStatus, ReadonlySet<TicketStatus>> = {
  new: new Set<TicketStatus>(["open", "in_progress", "pending", "on_hold", "cancelled"]),
  open: new Set<TicketStatus>(["in_progress", "pending", "on_hold", "resolved", "cancelled"]),
  in_progress: new Set<TicketStatus>(["open", "pending", "on_hold", "resolved", "cancelled"]),
  pending: new Set<TicketStatus>(["open", "in_progress", "on_hold", "resolved", "cancelled"]),
  on_hold: new Set<TicketStatus>(["open", "in_progress", "pending", "resolved", "cancelled"]),
  resolved: new Set<TicketStatus>(["open", "closed"]),
  closed: new Set<TicketStatus>(["open"]),
  cancelled: new Set<TicketStatus>(["open"]),
};

export function isAllowedTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true; // no-op writes are allowed
  return !!TRANSITIONS[from]?.has(to);
}

export function allowedNextStatuses(from: TicketStatus): TicketStatus[] {
  return Array.from(TRANSITIONS[from] || []);
}

/**
 * Throws when the transition is blocked. Returns void on success. Keeps the
 * decision lookup co-located so the route layer just calls `assertTransition`
 * and converts a thrown error into a 400 response.
 */
export class WorkflowError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!isAllowedTransition(from, to)) {
    throw new WorkflowError(
      `Invalid status transition: ${from} → ${to}. Allowed: ${allowedNextStatuses(from).join(", ") || "(none)"}`,
    );
  }
}
