/**
 * Routing rules engine. Evaluated at ticket-create time before auto-assign.
 * Rules are tenant-scoped, ordered by `sortOrder`, and only the active ones
 * apply. The first matching rule (or first chain of non-stop-on-match rules)
 * sets queue / assignee / priority hints; the existing auto-assign service
 * still picks the actual queue member.
 *
 * Conditions are matched case-insensitively for the *Contains predicates.
 * All present conditions in a rule must match (AND); a rule with no
 * conditions matches every ticket (useful for a catch-all final rule).
 */

import { db } from "../db";
import { supportRoutingRules, type SupportRoutingRule, type SupportTicket } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { logger } from "./logger";

interface RuleConditions {
  subjectContains?: string;
  descriptionContains?: string;
  category?: string;
  priority?: string;
  source?: string;
  applicationSource?: string;
  ticketType?: string;
}

function strContains(haystack: string | null | undefined, needle: string | undefined): boolean {
  if (!needle) return true;
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function strEq(a: string | null | undefined, b: string | undefined): boolean {
  if (!b) return true;
  return (a || "").toLowerCase() === b.toLowerCase();
}

function matchesRule(rule: SupportRoutingRule, ticket: Partial<SupportTicket>): boolean {
  const cond = (rule.conditions || {}) as RuleConditions;
  if (!strContains(ticket.subject, cond.subjectContains)) return false;
  if (!strContains(ticket.description, cond.descriptionContains)) return false;
  if (!strEq(ticket.category, cond.category)) return false;
  if (!strEq(ticket.priority, cond.priority)) return false;
  if (!strEq(ticket.source, cond.source)) return false;
  if (!strEq(ticket.applicationSource, cond.applicationSource)) return false;
  if (!strEq(ticket.ticketType, cond.ticketType)) return false;
  return true;
}

export interface RoutingResult {
  queueId?: string | null;
  assignedTo?: string | null;
  priority?: string | null;
  matchedRules: Array<{ id: string; name: string; action: string }>;
}

export async function applyRoutingRules(
  tenantId: string,
  ticket: Partial<SupportTicket>,
): Promise<RoutingResult> {
  const result: RoutingResult = { matchedRules: [] };
  try {
    const rules = await db
      .select()
      .from(supportRoutingRules)
      .where(and(eq(supportRoutingRules.tenantId, tenantId), eq(supportRoutingRules.isActive, true)))
      .orderBy(asc(supportRoutingRules.sortOrder));

    for (const rule of rules) {
      if (!matchesRule(rule, ticket)) continue;
      switch (rule.action) {
        case "route_to_queue":
          if (rule.targetQueueId && result.queueId == null) result.queueId = rule.targetQueueId;
          break;
        case "assign_to_user":
          if (rule.targetUserId && result.assignedTo == null) result.assignedTo = rule.targetUserId;
          break;
        case "set_priority":
          if (rule.targetPriority && result.priority == null) result.priority = rule.targetPriority;
          break;
      }
      result.matchedRules.push({ id: rule.id, name: rule.name, action: rule.action });
      if (rule.stopOnMatch) break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("routing_rules_eval_failed", { tenantId, err: msg });
  }
  return result;
}
