import type { Express } from "express";
import { z } from "zod";
import { getAuditEntries, getAuditEntriesForTenant } from "../lib/audit";
import { storage } from "../storage";

interface AuditRouteDeps {
  requireAuth: any;
}

const isStaffUser = (user: any): boolean => {
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

const isPlatformAdmin = (user: any): boolean => {
  if (!user) return false;
  return (
    user.platformRole === "global_admin" ||
    user.platformRole === "constellation_admin" ||
    user.role === "global_admin" ||
    user.role === "constellation_admin"
  );
};

export function registerAuditRoutes(app: Express, deps: AuditRouteDeps) {
  const { requireAuth } = deps;

  // Resource-scoped audit trail (admin only). Used by the support console to
  // show the immutable history of a specific ticket / queue / SLA policy.
  app.get("/api/audit/:resourceType/:resourceId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaffUser(user)) return res.status(403).json({ error: "Forbidden" });

    const { resourceType, resourceId } = req.params;
    const limit = Math.max(1, Math.min(parseInt((req.query.limit as string) || "200", 10) || 200, 500));

    // For support tickets, validate the resource itself belongs to the caller's
    // tenant (so a 404 is returned for missing tickets, not just an empty list).
    if (resourceType === "support_ticket") {
      const ticket = await storage.getSupportTicketById(resourceId);
      if (!ticket) return res.status(404).json({ error: "Resource not found" });
      if (!isPlatformAdmin(user) && ticket.tenantId !== user.tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // For non-platform admins, scope the audit query to the caller's tenant
    // so they can't pull entries for arbitrary resourceIds across tenants.
    const scopeTenantId = isPlatformAdmin(user) ? null : user.tenantId;
    const entries = await getAuditEntries(resourceType, resourceId, limit, scopeTenantId);
    return res.json(entries);
  });

  // Tenant-scoped audit trail (tenant admin sees their own; platform admin may
  // pass ?tenantId=…). Filterable by resourceType and actorUserId.
  app.get("/api/audit", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!isStaffUser(user)) return res.status(403).json({ error: "Forbidden" });

    const tenantId = isPlatformAdmin(user)
      ? ((req.query.tenantId as string) || user.tenantId)
      : user.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId is required" });

    const schema = z.object({
      resourceType: z.string().min(1).max(64).optional(),
      actorUserId: z.string().min(1).max(64).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.errors });

    const entries = await getAuditEntriesForTenant(tenantId, parsed.data);
    return res.json(entries);
  });
}
