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
  opts: { onlyUnread?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  const conds = [eq(notifications.userId, userId)];
  if (opts.onlyUnread) conds.push(isNull(notifications.readAt));
  return db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.max(1, Math.min(opts.limit ?? 50, 200)));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`,
  );
  const row: any = ((result as any).rows || result)[0];
  return Number(row?.c || 0);
}

export async function markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return updated.length;
}
