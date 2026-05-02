import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_TYPES } from "@shared/schema";

const s = storage as any;

// Hash an API key with a per-record salt baked into the hash format: sha256(prefix + ":" + secret)
function hashKey(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export async function authenticateAppKey(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") || "";
  const headerKey = req.header("x-synozur-api-key");
  let plain: string | undefined;
  if (auth.toLowerCase().startsWith("bearer ")) plain = auth.substring(7).trim();
  if (!plain && headerKey) plain = headerKey.trim();
  if (!plain) return res.status(401).json({ error: "Missing API key (use Authorization: Bearer or X-Synozur-Api-Key)" });

  const prefix = plain.split(".")[0];
  if (!prefix) return res.status(401).json({ error: "Malformed API key" });

  const candidates = await s.getSupportAppIntegrationKeysByPrefix(prefix);
  const hash = hashKey(plain);
  const match = candidates.find((k: any) => k.keyHash === hash && !k.revokedAt);
  if (!match) return res.status(401).json({ error: "Invalid API key" });

  await s.touchSupportAppIntegrationKey(match.id);
  (req as any).appIntegrationKey = match;
  next();
}

const externalCreateTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(1),
  category: z.enum(TICKET_CATEGORIES).default("question"),
  ticketType: z.enum(TICKET_TYPES).optional(),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  requester: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
  applicationSource: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  externalReferenceId: z.string().optional(),
});

export function registerSupportExternalRoutes(app: Express) {
  // POST /api/external/v1/support/tickets — file a ticket from a SYNOZUR app
  app.post("/api/external/v1/support/tickets", authenticateAppKey, async (req: Request, res: Response) => {
    try {
      const key = (req as any).appIntegrationKey;
      const parsed = externalCreateTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      const data = parsed.data;

      const meta = { ...(data.metadata || {}) };
      if (data.externalReferenceId) meta.externalReferenceId = data.externalReferenceId;
      meta.viaApiKey = { id: key.id, application: key.applicationName };

      const portalToken = crypto.randomBytes(24).toString("hex");
      const ticketType = data.ticketType || key.defaultTicketType || "incident";

      // Try to bind to an existing user with this email in the tenant
      const existingUser = await s.getUserByEmail?.(data.requester.email);
      const userId = existingUser?.tenantId === key.tenantId ? existingUser.id : null;

      const ticket = await s.createSupportTicket({
        tenantId: key.tenantId,
        userId,
        category: data.category,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        status: "new",
        ticketType,
        source: "api",
        applicationSource: data.applicationSource || key.applicationName,
        queueId: key.defaultQueueId || null,
        appIntegrationKeyId: key.id,
        portalToken,
        externalRequesterEmail: userId ? null : data.requester.email,
        externalRequesterName: userId ? null : (data.requester.name || null),
        metadata: meta,
      });

      // Apply SLA
      try {
        const policy = await s.findMatchingSlaPolicy(key.tenantId, data.priority, ticketType);
        if (policy) {
          const now = new Date();
          await s.updateSupportTicket(ticket.id, {
            slaPolicyId: policy.id,
            firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMinutes * 60_000) as any,
            resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000) as any,
          });
        }
      } catch (e) { /* non-fatal */ }

      await s.logSupportTicketActivity({
        ticketId: ticket.id,
        actorLabel: `API:${key.applicationName}`,
        action: "created",
        note: data.externalReferenceId ? `External ref: ${data.externalReferenceId}` : null,
      });

      const APP_URL = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const portalUrl = `${APP_URL}/portal/ticket/${portalToken}`;

      // Best-effort confirmation email to the requester
      try {
        const { sendExternalTicketConfirmation } = await import("../email-support");
        await sendExternalTicketConfirmation(ticket, data.requester, portalUrl);
      } catch (e) { console.warn("[EXT-API] confirmation email failed:", e); }

      return res.status(201).json({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        portalUrl,
        portalToken,
      });
    } catch (err: any) {
      console.error("[EXT-API] Failed to create ticket:", err);
      return res.status(500).json({ error: "Failed to create ticket", message: err?.message });
    }
  });

  // GET /api/external/v1/support/tickets/:id — read status
  app.get("/api/external/v1/support/tickets/:id", authenticateAppKey, async (req: Request, res: Response) => {
    try {
      const key = (req as any).appIntegrationKey;
      const t = await s.getSupportTicketById(req.params.id);
      if (!t) return res.status(404).json({ error: "Not found" });
      if (t.tenantId !== key.tenantId) return res.status(403).json({ error: "Forbidden" });
      return res.json({
        id: t.id,
        ticketNumber: t.ticketNumber,
        status: t.status,
        priority: t.priority,
        ticketType: t.ticketType,
        subject: t.subject,
        slaBreached: t.slaBreached,
        firstResponseAt: t.firstResponseAt,
        resolvedAt: t.resolvedAt,
        closedAt: t.closedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      });
    } catch (err: any) {
      console.error("[EXT-API] Failed to fetch ticket:", err);
      return res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // POST /api/external/v1/support/tickets/:id/replies — append from a SYNOZUR app
  app.post("/api/external/v1/support/tickets/:id/replies", authenticateAppKey, async (req: Request, res: Response) => {
    try {
      const key = (req as any).appIntegrationKey;
      const t = await s.getSupportTicketById(req.params.id);
      if (!t) return res.status(404).json({ error: "Not found" });
      if (t.tenantId !== key.tenantId) return res.status(403).json({ error: "Forbidden" });
      const body = z.object({ message: z.string().min(1), authorEmail: z.string().email().optional(), authorName: z.string().optional() }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      const reply = await s.createSupportTicketReply({
        ticketId: t.id,
        userId: t.userId || (await s.getUserByEmail?.(body.data.authorEmail || ""))?.id || null,
        message: body.data.message,
        isInternal: false,
      } as any);
      await s.logSupportTicketActivity({
        ticketId: t.id,
        actorLabel: `API:${key.applicationName}`,
        action: "comment_added",
        note: body.data.authorEmail || null,
      });
      return res.status(201).json({ id: reply.id });
    } catch (err: any) {
      console.error("[EXT-API] Failed to add reply:", err);
      return res.status(500).json({ error: "Failed to add reply" });
    }
  });

  // Healthcheck for SYNOZUR apps to verify their key
  app.get("/api/external/v1/support/whoami", authenticateAppKey, (req: Request, res: Response) => {
    const key = (req as any).appIntegrationKey;
    res.json({ ok: true, application: key.applicationName, tenantId: key.tenantId, scopes: key.scopes || [] });
  });
}

// Helper used by admin routes when minting a new key
export function mintApiKey(): { plain: string; prefix: string; hash: string } {
  const prefix = "syn_" + crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("base64url");
  const plain = `${prefix}.${secret}`;
  return { plain, prefix, hash: hashKey(plain) };
}
