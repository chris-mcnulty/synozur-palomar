/**
 * In-app notification helpers. The support module dispatches notifications
 * for: ticket assignment, new reply, status change, SLA breach, watcher add.
 *
 * Like `audit.ts`, failures here are swallowed (per-user notifications are
 * best-effort — a missing notification must never roll back a successful
 * ticket update). Failures are logged so a silently-broken pipeline can be
 * detected.
 */

import { db } from "../db";
import {
  notifications,
  type InsertNotification,
  type Notification,
  type NotificationType,
} from "@shared/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}

export async function notifyUser(userId: string | null | undefined, input: NotifyInput): Promise<void> {
  if (!userId) return;
  try {
    const row: InsertNotification = {
      userId,
      tenantId: input.tenantId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: (input.metadata as any) ?? null,
    };
    await db.insert(notifications).values(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[NOTIFY] Failed to notify user ${userId} (${input.type}): ${msg}`);
  }
}

export async function notifyUsers(userIds: Array<string | null | undefined>, input: NotifyInput): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (unique.length === 0) return;
  await Promise.all(unique.map((uid) => notifyUser(uid, input)));
}

export async function listNotificationsForUser(
  userId: string,
  opts: { onlyUnread?: boolean; limit?: number; tenantId?: string | null } = {},
): Promise<Notification[]> {
  const conds = [eq(notifications.userId, userId)];
  if (opts.onlyUnread) conds.push(isNull(notifications.readAt));
  if (opts.tenantId) conds.push(eq(notifications.tenantId, opts.tenantId));
  return db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.max(1, Math.min(opts.limit ?? 50, 200)));
}

export async function countUnreadNotifications(userId: string, tenantId?: string | null): Promise<number> {
  const conds = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (tenantId) conds.push(eq(notifications.tenantId, tenantId));
  const [row] = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(...conds));
  return Number(row?.c || 0);
}

export async function markNotificationRead(
  id: string,
  userId: string,
  tenantId?: string | null,
): Promise<Notification | undefined> {
  const conds = [eq(notifications.id, id), eq(notifications.userId, userId)];
  if (tenantId) conds.push(eq(notifications.tenantId, tenantId));
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conds))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string, tenantId?: string | null): Promise<number> {
  const conds = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (tenantId) conds.push(eq(notifications.tenantId, tenantId));
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conds))
    .returning({ id: notifications.id });
  return updated.length;
}
