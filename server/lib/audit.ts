/**
 * Append-only audit log. Records who did what, when, and (for field changes)
 * what the old and new values were. Writes go through `recordAudit()`; no
 * update/delete helpers exist by design — this table is the trust anchor for
 * dispute resolution and compliance, so it stays immutable from app code.
 *
 * The legacy `support_ticket_activity` table continues to drive the in-app
 * timeline view; this audit log is the parallel, immutable record of the same
 * (and other) events. Failures here are swallowed so they never break a write
 * path — but they are logged so we can detect a silently broken audit pipeline.
 */

import { db } from "../db";
import { auditLog, type InsertAuditLog } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface AuditEvent {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  actorIp?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
}

function toAuditString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const row: InsertAuditLog = {
      tenantId: event.tenantId ?? null,
      actorUserId: event.actorUserId ?? null,
      actorLabel: event.actorLabel ?? null,
      actorIp: event.actorIp ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      fieldName: event.fieldName ?? null,
      oldValue: toAuditString(event.oldValue),
      newValue: toAuditString(event.newValue),
      metadata: (event.metadata as any) ?? null,
      correlationId: event.correlationId ?? null,
    };
    await db.insert(auditLog).values(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AUDIT] Failed to record event ${event.action} on ${event.resourceType}:${event.resourceId}: ${msg}`);
  }
}

/**
 * Record a diff between old and new objects for a fixed set of tracked fields.
 * Emits one audit row per changed field. Used by PATCH endpoints to capture
 * the full field-level history without exploding the call site.
 */
export async function recordAuditDiff(
  base: AuditEvent & { action: string },
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  fields: readonly string[],
): Promise<void> {
  for (const field of fields) {
    if (!(field in newRecord)) continue;
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];
    if (toAuditString(oldVal) === toAuditString(newVal)) continue;
    await recordAudit({
      ...base,
      fieldName: field,
      oldValue: oldVal,
      newValue: newVal,
    });
  }
}

export async function getAuditEntries(
  resourceType: string,
  resourceId: string,
  limit = 200,
): Promise<Array<typeof auditLog.$inferSelect>> {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.resourceType, resourceType), eq(auditLog.resourceId, resourceId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.max(1, Math.min(limit, 500)));
}

export async function getAuditEntriesForTenant(
  tenantId: string,
  opts: { resourceType?: string; actorUserId?: string; limit?: number } = {},
): Promise<Array<typeof auditLog.$inferSelect>> {
  const conds = [eq(auditLog.tenantId, tenantId)];
  if (opts.resourceType) conds.push(eq(auditLog.resourceType, opts.resourceType));
  if (opts.actorUserId) conds.push(eq(auditLog.actorUserId, opts.actorUserId));
  return db
    .select()
    .from(auditLog)
    .where(and(...conds))
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.max(1, Math.min(opts.limit ?? 200, 500)));
}
