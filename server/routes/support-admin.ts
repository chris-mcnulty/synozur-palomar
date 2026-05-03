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
import type { InsertSupportTicketReply, SupportTicketReply, SupportTicket } from "@shared/schema";
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
    const u = (req as any).user;
    const isPlatform = u?.platformRole === 'global_admin' || u?.platformRole === 'constellation_admin' || u?.role === 'global_admin' || u?.role === 'constellation_admin';
    const queryTenantId = (req.query.tenantId as string | undefined) || undefined;
    const tenantId = (isPlatform && queryTenantId) ? queryTenantId : getTenantId(req);
    if (!tenantId) {
      // Platform admins without a tenant context get an empty list rather
      // than 400, so the support console renders for them.
      if (isPlatform) return res.json([]);
      return res.status(400).json({ error: "No tenant" });
    }
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

  // ===== Queue Members (for auto-assignment) =====
  app.get("/api/support/queues/:id/members", requireAuth, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    return res.json(await s.getSupportQueueMembers(req.params.id));
  });

  app.put("/api/support/queues/:id/members", requireAuth, adminOnly, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    const body = z.object({ userIds: z.array(z.string()) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    await s.setSupportQueueMembers(req.params.id, body.data.userIds);
    return res.json(await s.getSupportQueueMembers(req.params.id));
  });

  app.post("/api/support/queues/:id/members", requireAuth, adminOnly, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    const body = z.object({ userId: z.string() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
    return res.status(201).json(await s.addSupportQueueMember(req.params.id, body.data.userId));
  });

  app.delete("/api/support/queues/:id/members/:userId", requireAuth, adminOnly, async (req, res) => {
    const q = await s.getSupportQueueById(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    if (!ensureTenantOrAdmin(req, res, q.tenantId)) return;
    await s.removeSupportQueueMember(req.params.id, req.params.userId);
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
    const u = (req as any).user;
    const isPlatform = u?.platformRole === 'global_admin' || u?.platformRole === 'constellation_admin' || u?.role === 'global_admin' || u?.role === 'constellation_admin';
    const queryTenantId = (req.query.tenantId as string | undefined) || undefined;
    const tenantId = (isPlatform && queryTenantId) ? queryTenantId : getTenantId(req);
    if (!tenantId) {
      if (isPlatform) return res.json([]);
      return res.status(400).json({ error: "No tenant" });
    }
    const visibility = (req.query.visibility as string | undefined) || undefined;
    const search = (req.query.q as string | undefined) || undefined;
    const published = req.query.published === 'true' ? true : undefined;
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? Math.max(1, Math.min(50, parseInt(limitRaw, 10) || 0)) : undefined;
    return res.json(await s.getSupportKbArticles(tenantId, { visibility, search, published, limit }));
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

      const attachmentSchema = z.object({
        fileName: z.string().min(1).max(500),
        contentType: z.string().max(200).optional().nullable(),
        // Either base64 content OR a download URL the worker can fetch
        contentBase64: z.string().optional(),
        size: z.number().int().nonnegative().optional(),
      });
      const body = z.object({
        from: z.object({ email: z.string().email(), name: z.string().optional() }),
        to: z.union([z.string(), z.array(z.string())]).optional(),
        cc: z.union([z.string(), z.array(z.string())]).optional(),
        subject: z.string().default("(no subject)"),
        text: z.string().default(""),
        html: z.string().optional(),
        // RFC 5322 threading info supplied by the upstream gateway
        messageId: z.string().optional().nullable(),
        inReplyTo: z.string().optional().nullable(),
        references: z.union([z.string(), z.array(z.string())]).optional().nullable(),
        // Raw header bag for bounce/auto-reply detection
        headers: z.record(z.union([z.string(), z.array(z.string())])).optional().nullable(),
        ticketNumber: z.coerce.number().int().optional(),
        attachments: z.array(attachmentSchema).optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      const data = body.data;
      const ownerTenantId = tenantId!; // already set above

      const {
        findReplyToToken, normalizeMessageId, isBounceOrAutoReply, stripQuotedReply,
      } = await import("../email-support");

      // 1) Bounce / autoresponder filter — log and skip silently with 200 so
      //    upstream gateways don't retry forever.
      const bounce = isBounceOrAutoReply({
        headers: data.headers ?? undefined,
        fromEmail: data.from.email,
        subject: data.subject,
      });
      if (bounce.skip) {
        console.log(`[EMAIL-INBOUND] skipping (${bounce.reason}) from=${data.from.email} subject=${data.subject}`);
        return res.json({ ok: true, action: "skipped", reason: bounce.reason });
      }

      // 2) Resolve the target ticket using the most reliable signal first.
      //    a) ticket+<token>@... in To/Cc (we set this Reply-To on every outbound).
      //    b) In-Reply-To / References → look up reply by stored Message-ID.
      //    c) Ticket # in subject (legacy).
      let ticket: SupportTicket | null = null;
      let resolution = "none";

      const token = findReplyToToken(data.to, data.cc, data.headers?.["to"], data.headers?.["cc"]);
      if (token) {
        const t = await s.getSupportTicketByPortalToken(token);
        if (t && t.tenantId === ownerTenantId) {
          ticket = t;
          resolution = "reply_to_token";
        }
      }

      const inReplyToNorm = normalizeMessageId(data.inReplyTo ?? null);
      const refsList: string[] = [];
      if (data.references) {
        const raw = Array.isArray(data.references) ? data.references.join(" ") : String(data.references);
        for (const m of raw.split(/\s+/)) {
          const n = normalizeMessageId(m);
          if (n) refsList.push(n);
        }
      }
      if (!ticket && (inReplyToNorm || refsList.length)) {
        const candidates = [inReplyToNorm, ...refsList].filter(Boolean) as string[];
        for (const cand of candidates) {
          const r = await s.getSupportTicketReplyByMessageId(cand);
          if (r) {
            const t = await s.getSupportTicketById(r.ticketId);
            if (t && t.tenantId === ownerTenantId) { ticket = t; resolution = "in_reply_to"; break; }
          }
        }
      }

      if (!ticket) {
        const numMatch = data.ticketNumber || (data.subject.match(/#(\d+)/)?.[1] && Number(data.subject.match(/#(\d+)/)![1]));
        if (numMatch) {
          const t = await s.getSupportTicketByNumberAndEmail(ownerTenantId, Number(numMatch), data.from.email);
          if (t) { ticket = t; resolution = "subject_number"; }
        }
      }

      // Storage helper for attachments — used for both reply and new-ticket paths.
      const persistAttachments = async (ticketId: string, replyId: string | null) => {
        if (!data.attachments || !data.attachments.length) return;
        const { supportAttachmentStorage } = await import("../services/support-attachment-storage");
        for (const a of data.attachments) {
          if (!a.contentBase64) continue; // URL-fetch path is handled by Graph worker upstream
          try {
            const buf = Buffer.from(a.contentBase64, "base64");
            const stored = await supportAttachmentStorage.store(buf, a.fileName, a.contentType || "application/octet-stream", ticketId);
            await s.createSupportTicketAttachment({
              ticketId,
              replyId,
              fileName: a.fileName,
              contentType: a.contentType || null,
              sizeBytes: stored.size,
              storageKey: stored.storageKey,
              storageBackend: stored.storageBackend,
            });
          } catch (attErr) {
            console.error("[EMAIL-INBOUND] attachment store failed:", attErr);
          }
        }
      };

      // 3) Append-as-reply path
      if (ticket) {
        const rawBody = data.text || "";
        const trimmedBody = stripQuotedReply(rawBody);
        const replyInput: InsertSupportTicketReply = {
          ticketId: ticket.id,
          userId: null,
          message: trimmedBody || "(empty body)",
          rawMessage: rawBody && rawBody !== trimmedBody ? rawBody : null,
          isInternal: false,
          messageId: normalizeMessageId(data.messageId ?? null),
          inReplyTo: inReplyToNorm,
          source: "email",
          externalAuthor: data.from.email,
        };
        const reply: SupportTicketReply = await s.createSupportTicketReply(replyInput);
        await persistAttachments(ticket.id, reply.id);
        await s.logSupportTicketActivity({
          ticketId: ticket.id,
          actorLabel: data.from.email,
          action: "comment_added",
          note: `via email (${resolution})`,
        });
        if (ticket.status === "new") await s.updateSupportTicket(ticket.id, { status: "open" });
        return res.json({ ok: true, ticketId: ticket.id, action: "appended_reply", resolution });
      }

      // 4) Create a new ticket
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

      // Persist the inbound message itself as the seed reply so future replies
      // can chain via In-Reply-To.
      const seedRaw = data.text || "";
      const seedTrimmed = stripQuotedReply(seedRaw);
      const seedReplyInput: InsertSupportTicketReply = {
        ticketId: created.id,
        userId: null,
        message: seedTrimmed || "(empty body)",
        rawMessage: seedRaw && seedRaw !== seedTrimmed ? seedRaw : null,
        isInternal: true, // seed copy mirrors the description; keep internal
        messageId: normalizeMessageId(data.messageId ?? null),
        source: "email",
        externalAuthor: data.from.email,
      };
      const seedReply: SupportTicketReply = await s.createSupportTicketReply(seedReplyInput);
      await persistAttachments(created.id, seedReply.id);

      await s.logSupportTicketActivity({ ticketId: created.id, actorLabel: data.from.email, action: "created", note: "via email" });

      try {
        const { autoAssignTicketToQueueMember } = await import("../services/support-auto-assign");
        await autoAssignTicketToQueueMember(created.id, { actorLabel: "inbound-email" });
      } catch {}

      return res.status(201).json({ ok: true, ticketId: created.id, ticketNumber: created.ticketNumber, action: "created" });
    } catch (err: any) {
      console.error("[EMAIL-INBOUND] failed:", err);
      return res.status(500).json({ error: "Failed to process inbound email" });
    }
  });

  // ===== Inbound attachment download (agent console) =====
  // Authorization mirrors /api/support/tickets/:id: only the ticket owner
  // (or a Constellation/global support admin) may list/download attachments.
  const ensureTicketAccess = (req: Request, res: Response, t: { tenantId: string; userId: string | null }): boolean => {
    const u = (req as Request & { user?: { id?: string; role?: string; platformRole?: string } }).user;
    if (!u) { res.status(401).json({ error: "Authentication required" }); return false; }
    const role = u.role || "";
    const isPlatformAdmin = role === "global_admin" || role === "constellation_admin" || u.platformRole === "global_admin";
    const isSupportAdmin = ["admin", "billing-admin"].includes(role) || isPlatformAdmin;
    const myTenant = getTenantId(req);
    const sameTenant = myTenant === t.tenantId;
    const isOwner = !!t.userId && t.userId === u.id && sameTenant;
    if (isPlatformAdmin) return true;
    if (isOwner) return true;
    if (isSupportAdmin && sameTenant) return true;
    res.status(403).json({ error: "Access denied" });
    return false;
  };

  app.get("/api/support/tickets/:ticketId/attachments", requireAuth, async (req, res) => {
    const t = await s.getSupportTicketById(req.params.ticketId);
    if (!t) return res.status(404).json({ error: "Ticket not found" });
    if (!ensureTicketAccess(req, res, t)) return;
    return res.json(await s.getSupportTicketAttachments(req.params.ticketId));
  });

  // ===== Microsoft Graph subscription management =====
  // POST /api/support/graph/subscriptions { mailbox, azureTenantId?, lifetimeMinutes? }
  app.post("/api/support/graph/subscriptions", requireAuth, adminOnly, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ error: "No tenant" });
      const body = z.object({
        mailbox: z.string().email(),
        azureTenantId: z.string().optional(),
        lifetimeMinutes: z.number().int().min(15).max(4230).optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      const tenant = await s.getTenant(tenantId);
      const azureTenantId = body.data.azureTenantId || tenant?.azureTenantId;
      if (!azureTenantId) return res.status(400).json({ error: "azureTenantId is required (set on tenant or in payload)" });
      const APP_URL = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const notificationUrl = `${APP_URL}/api/support/graph/notifications`;
      const { createMailSubscription } = await import("../services/support-graph-subscription");
      const sub = await createMailSubscription({
        tenantId, azureTenantId, mailbox: body.data.mailbox,
        notificationUrl, lifetimeMinutes: body.data.lifetimeMinutes,
      });
      return res.status(201).json(sub);
    } catch (err: any) {
      console.error("[GRAPH-SUB] create failed:", err);
      return res.status(500).json({ error: err?.message || "Failed to create subscription" });
    }
  });

  app.get("/api/support/graph/subscriptions", requireAuth, adminOnly, async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "No tenant" });
    const { listSubscriptions } = await import("../services/support-graph-subscription");
    // Scope to caller's tenant. Cross-tenant visibility requires platform admin.
    const u = (req as Request & { user?: { role?: string; platformRole?: string } }).user;
    const isPlatformAdmin = u?.role === "global_admin" || u?.role === "constellation_admin" || u?.platformRole === "global_admin";
    return res.json(await listSubscriptions(isPlatformAdmin ? undefined : tenantId));
  });

  app.post("/api/support/graph/subscriptions/:id/renew", requireAuth, adminOnly, async (req, res) => {
    try {
      const { supportEmailStorage } = await import("../storage/support-email-types");
      const sub = await supportEmailStorage.getSupportEmailSubscription(req.params.id);
      if (!sub) return res.status(404).json({ error: "Not found" });
      if (!ensureTenantOrAdmin(req, res, sub.tenantId)) return;
      const body = z.object({ lifetimeMinutes: z.number().int().min(15).max(4230).optional() }).safeParse(req.body || {});
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      const { renewSubscription } = await import("../services/support-graph-subscription");
      await renewSubscription(req.params.id, body.data.lifetimeMinutes ?? 60);
      const updated = await supportEmailStorage.getSupportEmailSubscription(req.params.id);
      return res.json(updated);
    } catch (err: any) {
      console.error("[GRAPH-SUB] renew failed:", err);
      return res.status(500).json({ error: err?.message || "Failed to renew subscription" });
    }
  });

  app.delete("/api/support/graph/subscriptions/:id", requireAuth, adminOnly, async (req, res) => {
    const { supportEmailStorage } = await import("../storage/support-email-types");
    const sub = await supportEmailStorage.getSupportEmailSubscription(req.params.id);
    if (!sub) return res.status(404).json({ error: "Not found" });
    // Tenant must own this subscription; platform admins can cross tenants.
    if (!ensureTenantOrAdmin(req, res, sub.tenantId)) return;
    const { deleteSubscription } = await import("../services/support-graph-subscription");
    await deleteSubscription(req.params.id);
    return res.json({ ok: true });
  });

  // Public Graph notification endpoint — handshakes with ?validationToken and
  // dispatches notifications back into /api/support/email-inbound. No auth: it's
  // protected by clientState matching inside the handler.
  app.post("/api/support/graph/notifications", async (req, res) => {
    const { handleGraphNotification } = await import("../services/support-graph-subscription");
    return handleGraphNotification(req, res);
  });

  app.get("/api/support/attachments/:id/download", requireAuth, async (req, res) => {
    const att = await s.getSupportTicketAttachmentById(req.params.id);
    if (!att) return res.status(404).json({ error: "Not found" });
    const t = await s.getSupportTicketById(att.ticketId);
    if (!t) return res.status(404).json({ error: "Ticket not found" });
    if (!ensureTicketAccess(req, res, t)) return;
    const { supportAttachmentStorage } = await import("../services/support-attachment-storage");
    const file = await supportAttachmentStorage.load(att.storageKey, att.storageBackend);
    if (!file) return res.status(404).json({ error: "Attachment file missing" });
    res.setHeader("Content-Type", att.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${att.fileName.replace(/"/g, "")}"`);
    file.stream.pipe(res);
  });
}
