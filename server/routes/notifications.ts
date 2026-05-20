import type { Express } from "express";
import { z } from "zod";
import {
  listNotificationsForUser,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/notifications";

interface NotificationRouteDeps {
  requireAuth: any;
}

const listQuerySchema = z.object({
  onlyUnread: z.union([z.literal("true"), z.literal("false")]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export function registerNotificationRoutes(app: Express, deps: NotificationRouteDeps) {
  const { requireAuth } = deps;

  // All notification reads/writes are scoped to the caller's active tenant.
  // The global `users` model lets a user belong to multiple tenants, so
  // filtering by userId alone would leak notifications across tenants.
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.errors });

    const rows = await listNotificationsForUser(user.id, {
      onlyUnread: parsed.data.onlyUnread === "true",
      limit: parsed.data.limit,
      tenantId: user.tenantId,
    });
    return res.json(rows);
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const count = await countUnreadNotifications(user.id, user.tenantId);
    return res.json({ count });
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const updated = await markNotificationRead(req.params.id, user.id, user.tenantId);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const n = await markAllNotificationsRead(user.id, user.tenantId);
    return res.json({ marked: n });
  });
}
