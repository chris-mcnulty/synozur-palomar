import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  supportRoutingRules,
  ROUTING_RULE_ACTIONS,
  TICKET_PRIORITIES,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { recordAudit } from "../lib/audit";

interface RoutingRoutesDeps {
  requireAuth: any;
  requireRole: (roles: string[]) => any;
}

const isPlatformAdmin = (user: any): boolean =>
  user?.platformRole === "global_admin" ||
  user?.platformRole === "constellation_admin" ||
  user?.role === "global_admin" ||
  user?.role === "constellation_admin";

const conditionSchema = z.object({
  subjectContains: z.string().max(200).optional(),
  descriptionContains: z.string().max(500).optional(),
  category: z.string().max(64).optional(),
  priority: z.string().max(16).optional(),
  source: z.string().max(32).optional(),
  applicationSource: z.string().max(64).optional(),
  ticketType: z.string().max(32).optional(),
}).strict();

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  conditions: conditionSchema,
  action: z.enum(ROUTING_RULE_ACTIONS),
  targetQueueId: z.string().optional().nullable(),
  targetUserId: z.string().optional().nullable(),
  targetPriority: z.enum(TICKET_PRIORITIES).optional().nullable(),
  stopOnMatch: z.boolean().optional(),
});

function validateActionTargets(rule: z.infer<typeof ruleSchema>): string | null {
  if (rule.action === "route_to_queue" && !rule.targetQueueId) return "targetQueueId is required for route_to_queue";
  if (rule.action === "assign_to_user" && !rule.targetUserId) return "targetUserId is required for assign_to_user";
  if (rule.action === "set_priority" && !rule.targetPriority) return "targetPriority is required for set_priority";
  return null;
}

export function registerSupportRoutingRoutes(app: Express, deps: RoutingRoutesDeps) {
  const { requireAuth, requireRole } = deps;

  const adminGate = [requireAuth, requireRole(["admin"])];

  app.get("/api/support/routing-rules", ...adminGate, async (req, res) => {
    const user = (req as any).user;
    const tenantId = isPlatformAdmin(user) ? ((req.query.tenantId as string) || user.tenantId) : user.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const rows = await db
      .select()
      .from(supportRoutingRules)
      .where(eq(supportRoutingRules.tenantId, tenantId))
      .orderBy(asc(supportRoutingRules.sortOrder));
    return res.json(rows);
  });

  app.post("/api/support/routing-rules", ...adminGate, async (req, res) => {
    const user = (req as any).user;
    const tenantId = isPlatformAdmin(user) ? ((req.body.tenantId as string) || user.tenantId) : user.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    const targetErr = validateActionTargets(parsed.data);
    if (targetErr) return res.status(400).json({ error: targetErr });

    const [created] = await db
      .insert(supportRoutingRules)
      .values({
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
        conditions: parsed.data.conditions as any,
        action: parsed.data.action,
        targetQueueId: parsed.data.targetQueueId || null,
        targetUserId: parsed.data.targetUserId || null,
        targetPriority: parsed.data.targetPriority || null,
        stopOnMatch: parsed.data.stopOnMatch ?? true,
        createdBy: user.id,
      })
      .returning();

    await recordAudit({
      tenantId,
      actorUserId: user.id,
      actorIp: req.ip || null,
      action: "support_routing_rule.created",
      resourceType: "support_routing_rule",
      resourceId: created.id,
      metadata: { name: created.name, action: created.action },
    });
    return res.status(201).json(created);
  });

  app.patch("/api/support/routing-rules/:id", ...adminGate, async (req, res) => {
    const user = (req as any).user;
    const [existing] = await db
      .select()
      .from(supportRoutingRules)
      .where(eq(supportRoutingRules.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!isPlatformAdmin(user) && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });

    // Re-validate targets against the merged end-state whenever any field
    // that affects validity changes — not only `action`. Otherwise a patch
    // like `{ targetQueueId: null }` against a `route_to_queue` rule would
    // leave a rule that can never execute correctly.
    const validityFields = ["action", "targetQueueId", "targetUserId", "targetPriority"] as const;
    const touchesValidity = validityFields.some((k) => k in parsed.data);
    if (touchesValidity) {
      const proposed = { ...existing, ...parsed.data } as any;
      const targetErr = validateActionTargets(proposed);
      if (targetErr) return res.status(400).json({ error: targetErr });
    }

    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
      if (parsed.data[k] !== undefined) (patch as any)[k] = parsed.data[k];
    }
    patch.updatedAt = new Date();

    const [updated] = await db
      .update(supportRoutingRules)
      .set(patch as any)
      .where(eq(supportRoutingRules.id, existing.id))
      .returning();

    await recordAudit({
      tenantId: existing.tenantId,
      actorUserId: user.id,
      actorIp: req.ip || null,
      action: "support_routing_rule.updated",
      resourceType: "support_routing_rule",
      resourceId: existing.id,
      metadata: { changes: parsed.data },
    });
    return res.json(updated);
  });

  app.delete("/api/support/routing-rules/:id", ...adminGate, async (req, res) => {
    const user = (req as any).user;
    const [existing] = await db
      .select()
      .from(supportRoutingRules)
      .where(eq(supportRoutingRules.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!isPlatformAdmin(user) && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(supportRoutingRules).where(eq(supportRoutingRules.id, existing.id));
    await recordAudit({
      tenantId: existing.tenantId,
      actorUserId: user.id,
      actorIp: req.ip || null,
      action: "support_routing_rule.deleted",
      resourceType: "support_routing_rule",
      resourceId: existing.id,
      metadata: { name: existing.name },
    });
    return res.status(204).end();
  });
}
