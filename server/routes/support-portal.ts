import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_TYPES } from "@shared/schema";

const s = storage as any;

// Simple in-memory rate limiter for public lookup endpoints (per-IP, sliding window).
const lookupRateBuckets = new Map<string, number[]>();
function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (lookupRateBuckets.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { lookupRateBuckets.set(ip, arr); return false; }
  arr.push(now);
  lookupRateBuckets.set(ip, arr);
  return true;
}

// Public-but-token-protected endpoints. Anyone holding the magic token can view
// or comment on the ticket. Tokens are 24-byte random hex (192 bits) — sufficient
// for unguessable per-ticket access. Tokens can be rotated by clearing the field.

async function loadByToken(req: Request, res: Response) {
  const token = req.params.token;
  if (!token || token.length < 16) { res.status(400).json({ error: "Invalid token" }); return null; }
  const ticket = await s.getSupportTicketByPortalToken(token);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return null; }
  return ticket;
}

function publicView(t: any, replies: any[] = [], activity: any[] = []) {
  // Only surface high-level status changes to the public — no PII, no field-level diffs.
  const PUBLIC_ACTIONS = new Set(["created", "comment_added", "status_changed", "resolved", "closed", "csat_submitted"]);
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    ticketType: t.ticketType,
    category: t.category,
    source: t.source,
    applicationSource: t.applicationSource,
    requesterName: t.externalRequesterName,
    // Email is intentionally NOT returned — anyone with the token would otherwise see it.
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    firstResponseAt: t.firstResponseAt,
    resolutionDueAt: t.resolutionDueAt,
    slaBreached: t.slaBreached,
    replies: replies
      .filter(r => !r.isInternal)
      .map(r => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt,
        author: r.user ? {
          name: `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || "Support",
        } : null,
      })),
    activity: activity
      .filter(a => PUBLIC_ACTIONS.has(a.action))
      .map(a => ({ id: a.id, action: a.action, createdAt: a.createdAt })),
  };
}

export function registerSupportPortalRoutes(app: Express) {
  // Lookup by ticket # + email (no token, e.g. user lost their link)
  app.post("/api/portal/lookup", async (req: Request, res: Response) => {
    try {
      const ip = (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
      if (!rateLimit(`lookup:${ip}`, 10, 60_000)) {
        return res.status(429).json({ error: "Too many requests. Please wait a minute." });
      }
      const body = z.object({
        ticketNumber: z.coerce.number().int().min(1),
        email: z.string().email(),
        tenantId: z.string().optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });

      let tenantId = body.data.tenantId;
      if (!tenantId) {
        // Try to derive from request hostname (subdomain routing). Fallback to all tenants is unsafe.
        const host = (req.get("host") || "").split(":")[0];
        const tenants = await s.getAllTenants?.() || [];
        const match = tenants.find((t: any) =>
          (t.subdomain && host.startsWith(t.subdomain + ".")) ||
          (t.customDomain && host === t.customDomain)
        );
        if (match) tenantId = match.id;
      }
      if (!tenantId) return res.status(400).json({ error: "tenantId is required when not on a tenant subdomain" });

      const ticket = await s.getSupportTicketByNumberAndEmail(tenantId, body.data.ticketNumber, body.data.email);
      if (!ticket) return res.status(404).json({ error: "No ticket matched. Check the ticket number and email." });

      // Re-issue a portal token if needed
      let token = ticket.portalToken;
      if (!token) {
        const crypto = await import("crypto");
        token = crypto.randomBytes(24).toString("hex");
        await s.updateSupportTicket(ticket.id, { portalToken: token });
      }
      const APP_URL = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      return res.json({ portalUrl: `${APP_URL}/portal/ticket/${token}`, token });
    } catch (err: any) {
      console.error("[PORTAL] lookup failed:", err);
      return res.status(500).json({ error: "Lookup failed" });
    }
  });

  // GET ticket via magic token
  app.get("/api/portal/tickets/:token", async (req: Request, res: Response) => {
    try {
      const ticket = await loadByToken(req, res);
      if (!ticket) return;
      const replies = await s.getSupportTicketReplies(ticket.id, /*includeInternal*/ false);
      const activity = await s.getSupportTicketActivity(ticket.id);
      const repliesWithUsers = await Promise.all(
        replies.map(async (r: any) => {
          const u = r.userId ? await s.getUser(r.userId) : null;
          return { ...r, user: u };
        })
      );
      return res.json(publicView(ticket, repliesWithUsers, activity));
    } catch (err: any) {
      console.error("[PORTAL] fetch failed:", err);
      return res.status(500).json({ error: "Failed to load ticket" });
    }
  });

  // POST reply via portal token (requester chimes in)
  app.post("/api/portal/tickets/:token/replies", async (req: Request, res: Response) => {
    try {
      const ticket = await loadByToken(req, res);
      if (!ticket) return;
      const body = z.object({ message: z.string().min(1).max(10000) }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      if (ticket.status === "closed" || ticket.status === "cancelled") {
        return res.status(400).json({ error: "Ticket is closed. Reply by creating a new ticket." });
      }

      const reply = await s.createSupportTicketReply({
        ticketId: ticket.id,
        userId: ticket.userId || null,
        message: body.data.message,
        isInternal: false,
      } as any);
      await s.logSupportTicketActivity({
        ticketId: ticket.id,
        actorLabel: ticket.externalRequesterEmail || "portal",
        action: "comment_added",
      });

      // Auto-bump status from new -> open when requester replies
      if (ticket.status === "new") {
        await s.updateSupportTicket(ticket.id, { status: "open" });
      }

      return res.status(201).json({ id: reply.id });
    } catch (err: any) {
      console.error("[PORTAL] reply failed:", err);
      return res.status(500).json({ error: "Failed to post reply" });
    }
  });

  // Submit CSAT
  app.post("/api/portal/tickets/:token/csat", async (req: Request, res: Response) => {
    try {
      const ticket = await loadByToken(req, res);
      if (!ticket) return;
      const body = z.object({
        score: z.coerce.number().int().min(1).max(5),
        comment: z.string().max(2000).optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });
      await s.updateSupportTicket(ticket.id, {
        csatScore: body.data.score,
        csatComment: body.data.comment || null,
        csatSubmittedAt: new Date(),
      });
      await s.logSupportTicketActivity({ ticketId: ticket.id, actorLabel: "portal", action: "csat_submitted", newValue: String(body.data.score) });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[PORTAL] csat failed:", err);
      return res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Anonymous public ticket creation (e.g. requester not in any tenant) — requires
  // a tenant context derived from request host or explicit tenantId param.
  app.post("/api/portal/tickets", async (req: Request, res: Response) => {
    try {
      const ip = (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
      if (!rateLimit(`create:${ip}`, 5, 60_000)) {
        return res.status(429).json({ error: "Too many requests. Please wait a minute." });
      }
      const body = z.object({
        tenantId: z.string().optional(),
        subject: z.string().min(3).max(200),
        description: z.string().min(1).max(20000),
        priority: z.enum(TICKET_PRIORITIES).default("medium"),
        category: z.enum(TICKET_CATEGORIES).default("question"),
        ticketType: z.enum(TICKET_TYPES).default("incident"),
        requesterEmail: z.string().email(),
        requesterName: z.string().max(200).optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Validation failed", details: body.error.errors });

      let tenantId = body.data.tenantId;
      if (!tenantId) {
        const host = (req.get("host") || "").split(":")[0];
        const tenants = await s.getAllTenants?.() || [];
        const match = tenants.find((t: any) =>
          (t.subdomain && host.startsWith(t.subdomain + ".")) ||
          (t.customDomain && host === t.customDomain)
        );
        if (match) tenantId = match.id;
      }
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });

      const crypto = await import("crypto");
      const portalToken = crypto.randomBytes(24).toString("hex");
      const ticket = await s.createSupportTicket({
        tenantId,
        userId: null,
        category: body.data.category,
        subject: body.data.subject,
        description: body.data.description,
        priority: body.data.priority,
        status: "new",
        ticketType: body.data.ticketType,
        source: "portal",
        applicationSource: "Portal",
        portalToken,
        externalRequesterEmail: body.data.requesterEmail,
        externalRequesterName: body.data.requesterName || null,
        metadata: null,
      });

      try {
        const policy = await s.findMatchingSlaPolicy(tenantId, body.data.priority, body.data.ticketType);
        if (policy) {
          const now = new Date();
          await s.updateSupportTicket(ticket.id, {
            slaPolicyId: policy.id,
            firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMinutes * 60_000) as any,
            resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000) as any,
          });
        }
      } catch {}

      const APP_URL = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const portalUrl = `${APP_URL}/portal/ticket/${portalToken}`;

      try {
        const { sendExternalTicketConfirmation } = await import("../email-support");
        await sendExternalTicketConfirmation(ticket, { email: body.data.requesterEmail, name: body.data.requesterName }, portalUrl);
      } catch {}

      return res.status(201).json({ id: ticket.id, ticketNumber: ticket.ticketNumber, portalUrl, portalToken });
    } catch (err: any) {
      console.error("[PORTAL] anon create failed:", err);
      return res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  // Public KB list (only published+public articles)
  app.get("/api/portal/kb", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const articles = await s.getSupportKbArticles(tenantId, { visibility: "public", published: true, search: req.query.q as string | undefined });
      return res.json(articles.map((a: any) => ({ id: a.id, slug: a.slug, title: a.title, summary: a.summary, tags: a.tags, updatedAt: a.updatedAt })));
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to load KB" });
    }
  });

  app.get("/api/portal/kb/:tenantId/:slug", async (req: Request, res: Response) => {
    try {
      const article = await s.getSupportKbArticleBySlug(req.params.tenantId, req.params.slug);
      if (!article || article.visibility !== "public" || !article.publishedAt) {
        return res.status(404).json({ error: "Article not found" });
      }
      await s.incrementKbArticleViewCount(article.id);
      return res.json(article);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to load article" });
    }
  });
}
