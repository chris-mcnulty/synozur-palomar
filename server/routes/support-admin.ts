import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  insertSupportQueueSchema,
  insertSupportSlaPolicySchema,
  insertSupportKbArticleSchema,
  supportTicketWatchers,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TICKET_CATEGORIES,
} from "@shared/schema";
import { mintApiKey } from "./support-external";

const s = storage as any;

function getTenantId(req: Request): string | null {
  const u = (req as any).user;
  return u?.activeTenantId || u?.primaryTenantId || u?.tenantId || null;
}

function ensureTenantOrAdmin(req: Request, res: Response, tenantId: string): boolean {
  const u = (req as any).user;
  const myTenant = getTenantId(req);
  if (myTenant === tenantId) return true;
  if (u?.role === "global_admin" || u?.role === "constellation_admin" || u?.platformRole === "global_admin") return true;
  res.status(403).json({ error: "Access denied" });
  return false;
}

interface Deps { requireAuth: any; requireRole: (roles: string[]) => any; }

export function registerSupportAdminRoutes(app: Express, deps: Deps) {
  const { requireAuth, requireRole } = deps;
  const adminOnly = requireRole(["admin"]);

  // ===== Queues =====
  app.get("/api/support/queues", requireAuth, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    return res.json(await s.getSupportQueues(tenantId));
  });

  app.post("/api/support/queues", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const body = insertSupportQueueSchema.omit({ tenantId: true } as any).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    const created = await s.createSupportQueue({ ...body.data, tenantId });
    return res.status(201).json(created);
  });

  app.patch("/api/support/queues/:id", requireAuth, adminOnly, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    const updated = await s.updateSupportQueue(req.params.id, req.body || {});
    return res.json(updated);
  });

  app.delete("/api/support/queues/:id", requireAuth, adminOnly, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    await s.deleteSupportQueue(req.params.id);
    return res.json({ ok: true });
  });

  // ===== SLA Policies =====
  app.get("/api/support/sla-policies", requireAuth, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    return res.json(await s.getSupportSlaPolicies(tenantId));
  });

  app.post("/api/support/sla-policies", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const body = insertSupportSlaPolicySchema.omit({ tenantId: true } as any).extend({
      priority: z.enum(TICKET_PRIORITIES),
      ticketType: z.enum(TICKET_TYPES).optional().nullable(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    return res.status(201).json(await s.createSupportSlaPolicy({ ...body.data, tenantId }));
  });

  app.patch("/api/support/sla-policies/:id", requireAuth, adminOnly, async (req, res) => {
    const p = await s.getSupportSlaPolicyById(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, p.tenantId)) return;
    return res.json(await s.updateSupportSlaPolicy(req.params.id, req.body || {}));
  });

  app.delete("/api/support/sla-policies/:id", requireAuth, adminOnly, async (req, res) => {
    const p = await s.getSupportSlaPolicyById(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, p.tenantId)) return;
    await s.deleteSupportSlaPolicy(req.params.id);
    return res.json({ ok: true });
  });

  // ===== Knowledge Base =====
  app.get("/api/support/kb", requireAuth, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const visibility = (req.query.visibility as string | undefined) || undefined;
    const search = (req.query.q as string | undefined) || undefined;
    return res.json(await s.getSupportKbArticles(tenantId, { visibility, search }));
  });

  app.get("/api/support/kb/:id", requireAuth, async (req, res) => {
    const article = await s.getSupportKbArticleById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, article.tenantId)) return;
    return res.json(article);
  });

  app.post("/api/support/kb", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const body = insertSupportKbArticleSchema.omit({ tenantId: true } as any).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    return res.status(201).json(await s.createSupportKbArticle({ ...body.data, tenantId, authorId: (req as any).user?.id || null }));
  });

  app.patch("/api/support/kb/:id", requireAuth, adminOnly, async (req, res) => {
    const article = await s.getSupportKbArticleById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, article.tenantId)) return;
    return res.json(await s.updateSupportKbArticle(req.params.id, req.body || {}));
  });

  app.delete("/api/support/kb/:id", requireAuth, adminOnly, async (req, res) => {
    const article = await s.getSupportKbArticleById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, article.tenantId)) return;
    await s.deleteSupportKbArticle(req.params.id);
    return res.json({ ok: true });
  });

  // ===== App Integration Keys (for SYNOZUR apps) =====
  app.get("/api/support/api-keys", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const keys = await s.getSupportAppIntegrationKeys(tenantId);
    return res.json(keys.map((k: any) => ({
      id: k.id,
      applicationName: k.applicationName,
      description: k.description,
      keyPrefix: k.keyPrefix,
      defaultQueueId: k.defaultQueueId,
      defaultTicketType: k.defaultTicketType,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
    })));
  });

  app.post("/api/support/api-keys", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const body = z.object({
      applicationName: z.string().min(1),
      description: z.string().optional(),
      defaultQueueId: z.string().optional(),
      defaultTicketType: z.enum(TICKET_TYPES).optional(),
      scopes: z.array(z.string()).optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });

    const { plain, prefix, hash } = mintApiKey();
    const created = await s.createSupportAppIntegrationKey({
      tenantId,
      applicationName: body.data.applicationName,
      description: body.data.description || null,
      keyPrefix: prefix,
      keyHash: hash,
      defaultQueueId: body.data.defaultQueueId || null,
      defaultTicketType: body.data.defaultTicketType || "incident",
      scopes: body.data.scopes || ["tickets:write", "tickets:read"],
      createdBy: (req as any).user?.id || null,
    });
    // Return the plaintext key ONCE
    return res.status(201).json({
      id: created.id,
      applicationName: created.applicationName,
      keyPrefix: created.keyPrefix,
      apiKey: plain,
      warning: "Store this key securely — it will not be shown again.",
    });
  });

  app.post("/api/support/api-keys/:id/revoke", requireAuth, adminOnly, async (req, res) => {
    const key = await s.getSupportAppIntegrationKeyById(req.params.id);
    if (!key) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, key.tenantId)) return;
    await s.revokeSupportAppIntegrationKey(req.params.id);
    return res.json({ ok: true });
  });

  async function requireTicketInTenant(req: Request, res: Response, ticketId: string) {
    const t = await s.getSupportTicketById(ticketId);
    if (!t) { res.status(404).json({ error: "Ticket not found" }); return null; }
    if (!ensureTenantOrAdmin(req, res, t.tenantId)) return null;
    return t;
  }

  // ===== Watchers (tenant-scoped) =====
  app.get("/api/support/tickets/:ticketId/watchers", requireAuth, async (req, res) => {
    if (!(await requireTicketInTenant(req, res, req.params.ticketId))) return;
    return res.json(await s.getSupportTicketWatchers(req.params.ticketId));
  });
  app.post("/api/support/tickets/:ticketId/watchers", requireAuth, async (req, res) => {
    if (!(await requireTicketInTenant(req, res, req.params.ticketId))) return;
    const body = z.object({
      userId: z.string().optional(),
      externalEmail: z.string().email().optional(),
    }).refine(d => d.userId || d.externalEmail, { message: "userId or externalEmail required" }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    return res.status(201).json(await s.addSupportTicketWatcher({ ticketId: req.params.ticketId, ...body.data } as any));
  });
  app.delete("/api/support/watchers/:id", requireAuth, async (req, res) => {
    const rows = await db.select().from(supportTicketWatchers)
      .where(eq(supportTicketWatchers.id, req.params.id)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    if (!(await requireTicketInTenant(req, res, rows[0].ticketId))) return;
    await s.removeSupportTicketWatcher(req.params.id);
    return res.json({ ok: true });
  });

  // ===== Activity (tenant-scoped) =====
  app.get("/api/support/tickets/:ticketId/activity", requireAuth, async (req, res) => {
    if (!(await requireTicketInTenant(req, res, req.params.ticketId))) return;
    return res.json(await s.getSupportTicketActivity(req.params.ticketId));
  });

  // ===== Inbound Email webhook =====
  // Auth: requires either (a) shared HMAC signature in `X-Inbound-Signature` over the raw body
  // using SUPPORT_INBOUND_EMAIL_SECRET, or (b) a valid app integration API key. The tenant is
  // ALWAYS derived from credentials, never trusted from the request body.
  app.post("/api/support/email-inbound", async (req: Request, res: Response) => {
    try {
      const inboundSecret = process.env.SUPPORT_INBOUND_EMAIL_SECRET;
      let tenantId: string | null = null;

      // Option A: API key (preferred)
      const auth = req.header("authorization") || "";
      const headerKey = req.header("x-synozur-api-key");
      let plainKey: string | undefined;
      if (auth.toLowerCase().startsWith("bearer ")) plainKey = auth.substring(7).trim();
      if (!plainKey && headerKey) plainKey = headerKey.trim();
      if (plainKey) {
        const prefix = plainKey.split(".")[0];
        const candidates = await s.getSupportAppIntegrationKeysByPrefix(prefix);
        const hash = crypto.createHash("sha256").update(plainKey).digest("hex");
        const match = candidates.find((k: any) => k.keyHash === hash && !k.revokedAt);
        if (!match) return res.status(401).json({ error: "Invalid API key" });
        tenantId = match.tenantId;
      } else if (inboundSecret) {
        // Option B: HMAC signature
        const provided = req.header("x-inbound-signature") || "";
        const tenantHeader = req.header("x-tenant-id");
        if (!tenantHeader) return res.status(401).json({ error: "Missing X-Tenant-Id" });
        const raw = JSON.stringify(req.body);
        const expected = crypto.createHmac("sha256", inboundSecret).update(raw).digest("hex");
        const ok = provided.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
        if (!ok) return res.status(401).json({ error: "Bad signature" });
        tenantId = tenantHeader;
      } else {
        return res.status(401).json({ error: "Inbound email auth not configured" });
      }

      const body = z.object({
        from: z.object({ email: z.string().email(), name: z.string().optional() }),
        subject: z.string().default("(no subject)"),
        text: z.string().default(""),
        html: z.string().optional(),
        ticketNumber: z.coerce.number().int().optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      const data = body.data;
      const ownerTenantId = tenantId!; // already set above

      // If subject contains [#NNN] or ticketNumber given, treat as a reply
      const numMatch = data.ticketNumber || (data.subject.match(/#(\d+)/)?.[1] && Number(data.subject.match(/#(\d+)/)![1]));
      if (numMatch) {
        const ticket = await s.getSupportTicketByNumberAndEmail(ownerTenantId, Number(numMatch), data.from.email);
        if (ticket) {
          await s.createSupportTicketReply({
            ticketId: ticket.id,
            userId: ticket.userId || null,
            message: data.text,
            isInternal: false,
          } as any);
          await s.logSupportTicketActivity({ ticketId: ticket.id, actorLabel: data.from.email, action: "comment_added", note: "via email" });
          if (ticket.status === "new") await s.updateSupportTicket(ticket.id, { status: "open" });
          return res.json({ ok: true, ticketId: ticket.id, action: "appended_reply" });
        }
      }

      // Otherwise create a new ticket
      const portalToken = crypto.randomBytes(24).toString("hex");
      const created = await s.createSupportTicket({
        tenantId: ownerTenantId,
        userId: null,
        category: "question",
        subject: data.subject,
        description: data.text,
        priority: "medium",
        status: "new",
        ticketType: "incident",
        source: "email",
        applicationSource: "Email",
        portalToken,
        externalRequesterEmail: data.from.email,
        externalRequesterName: data.from.name || null,
      });
      // Apply SLA for the email-created ticket
      try {
        const policy = await s.findMatchingSlaPolicy(ownerTenantId, "medium", "incident");
        if (policy) {
          const now = new Date();
          await s.updateSupportTicket(created.id, {
            slaPolicyId: policy.id,
            firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMinutes * 60_000) as any,
            resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000) as any,
          });
        }
      } catch {}
      await s.logSupportTicketActivity({ ticketId: created.id, actorLabel: data.from.email, action: "created", note: "via email" });
      return res.status(201).json({ ok: true, ticketId: created.id, ticketNumber: created.ticketNumber, action: "created" });
    } catch (err: any) {
      console.error("[EMAIL-INBOUND] failed:", err);
      return res.status(500).json({ error: "Failed to process inbound email" });
    }
  });
}
