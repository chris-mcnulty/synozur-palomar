import * as fsNode from "fs";
import * as pathNode from "path";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { sql, eq, and, gte, desc } from "drizzle-orm";

import { storage } from "./storage";
import { db } from "./db";
import {
  insertSystemSettingSchema,
  users,
  tenants,
  tenantUsers,
  servicePlans,
  blockedDomains,
  pageViews,
} from "@shared/schema";
import { isPublicEmailDomain } from "@shared/publicDomains";

import { registerAuthRoutes } from "./auth-routes";
import { requireAuth, requireRole, requirePlatformAdmin } from "./session-store";
import { msalInstance, authCodeRequest } from "./auth/entra-config";
import {
  checkAndRefreshToken,
  handleTokenRefresh,
  startTokenRefreshScheduler,
} from "./auth/sso-token-refresh";

import { buildAgentCard } from "./a2a/agent-card-data.js";
import { registerSupportRoutes } from "./routes/support.js";
import { registerSupportExternalRoutes } from "./routes/support-external.js";
import { registerSupportPortalRoutes } from "./routes/support-portal.js";
import { registerSupportAdminRoutes } from "./routes/support-admin.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerSupportLinkRoutes } from "./routes/support-links.js";
import { registerSupportRoutingRoutes } from "./routes/support-routing.js";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function resolveChangelogPath(): string {
  const candidates = [
    pathNode.join(process.cwd(), "client", "public", "docs", "CHANGELOG.md"),
    pathNode.join(process.cwd(), "dist", "public", "docs", "CHANGELOG.md"),
    pathNode.join(process.cwd(), "docs", "CHANGELOG.md"),
  ];
  for (const p of candidates) {
    try {
      if (fsNode.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

function readChangelogContent(): string {
  try {
    return fsNode.readFileSync(resolveChangelogPath(), "utf-8");
  } catch {
    return "";
  }
}

function extractFallbackHighlights(
  markdown: string,
): Array<{ icon: string; title: string; description: string }> {
  const highlights: Array<{ icon: string; title: string; description: string }> = [];
  const featurePattern = /\*\*([^*]+)\*\*\n((?:- [^\n]+\n?)+)/g;
  const icons = ["🚀", "💬", "📊", "📋", "🔧", "📚", "⚡", "🎯"];
  let iconIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = featurePattern.exec(markdown)) !== null && highlights.length < 5) {
    const title = match[1].trim();
    if (title === "Release Date:" || title === "Status:" || title === "Codename:") continue;
    const bullets = match[2]
      .split("\n")
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.replace(/^- /, "").trim());
    const description = bullets.slice(0, 2).join(". ");
    if (description) {
      highlights.push({ icon: icons[iconIdx % icons.length], title, description });
      iconIdx++;
    }
  }
  return highlights;
}

// ───────────────────────────────────────────────────────────────────────────
// Route registration
// ───────────────────────────────────────────────────────────────────────────

export async function registerRoutes(app: Express): Promise<void> {
  // ── /.well-known/agent.json — A2A discovery (public) ──
  app.get("/.well-known/agent.json", (_req: Request, res: Response) => {
    const baseUrl =
      process.env.BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`) ||
      "https://constellation.synozur.com";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(buildAgentCard(baseUrl));
  });

  // Seed CURRENT_CHANGELOG_VERSION from CHANGELOG.md (non-blocking)
  (async () => {
    try {
      const existing = await storage.getSystemSettingValue("CURRENT_CHANGELOG_VERSION", "");
      const content = readChangelogContent();
      if (!content) return;
      const match = content.match(/###\s+Version\s+([\d.]+)/);
      const fileVersion = match ? match[1] : "";
      if (fileVersion && fileVersion !== existing) {
        await storage.setSystemSetting(
          "CURRENT_CHANGELOG_VERSION",
          fileVersion,
          "Auto-detected from CHANGELOG.md at startup",
          "string",
        );
        console.log(`[CHANGELOG] Seeded CURRENT_CHANGELOG_VERSION: ${fileVersion}`);
      }
    } catch (err: any) {
      console.error("[CHANGELOG] Failed to seed changelog version:", err?.message);
    }
  })();

  // ── Auth routes ──
  registerAuthRoutes(app);

  // SSO token refresh scheduler
  startTokenRefreshScheduler();

  const isEntraConfigured = !!msalInstance;

  // ── Support module routes ──
  registerSupportRoutes(app, { requireAuth, requireRole });
  registerSupportExternalRoutes(app);
  registerSupportPortalRoutes(app);
  registerSupportAdminRoutes(app, { requireAuth, requireRole });

  // ── In-app notifications (Wave 1) ──
  registerNotificationRoutes(app, { requireAuth });

  // ── Audit log read endpoints (Wave 1) ──
  registerAuditRoutes(app, { requireAuth });

  // ── Ticket links / merge / duplicate (Wave 3) ──
  registerSupportLinkRoutes(app, { requireAuth });

  // ── Routing rules engine (Wave 3) ──
  registerSupportRoutingRoutes(app, { requireAuth, requireRole });

  // ── Environment ──
  app.get("/api/environment", async (_req, res) => {
    try {
      const isProduction =
        process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
      res.json({
        environment: isProduction ? "Production" : "Development",
        isProduction,
        nodeEnv: process.env.NODE_ENV,
        replitDeployment: process.env.REPLIT_DEPLOYMENT,
      });
    } catch {
      res.status(500).json({ message: "Failed to get environment info" });
    }
  });

  // ── Health ──
  app.get("/api/health", async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({
        status: "healthy",
        database: "connected",
        entraConfigured: isEntraConfigured,
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error: any) {
      console.error("[HEALTH] Database connection error:", error);
      res.status(503).json({
        status: "unhealthy",
        database: "error",
        error: error?.message || "Database connection failed",
        environment: process.env.NODE_ENV || "development",
      });
    }
  });

  // ── Agent card health (admin only) ──
  app.get("/api/admin/agent-card-health", requireAuth, requireRole(["admin"]), async (_req, res) => {
    try {
      const { getLastHealthCheckResult } = await import("./services/agent-card-health-scheduler.js");
      res.json({ result: getLastHealthCheckResult() });
    } catch (error) {
      console.error("[ADMIN] Error fetching agent card health result:", error);
      res.status(500).json({ message: "Failed to fetch agent card health status" });
    }
  });

  app.post(
    "/api/admin/agent-card-health/run",
    requireAuth,
    requireRole(["admin"]),
    async (_req, res) => {
      try {
        const { runAgentCardHealthCheck } = await import(
          "./services/agent-card-health-scheduler.js"
        );
        const result = await runAgentCardHealthCheck("manual");
        res.json({ result });
      } catch (error) {
        console.error("[ADMIN] Error running agent card health check:", error);
        res.status(500).json({ message: "Failed to run agent card health check" });
      }
    },
  );

  app.get(
    "/api/admin/agent-card-health/history",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
        const history = await storage.getAgentCardHealthChecks(limit);
        res.json({ history });
      } catch (error) {
        console.error("[ADMIN] Error fetching agent card health history:", error);
        res.status(500).json({ message: "Failed to fetch agent card health history" });
      }
    },
  );

  // ── System Settings (read: admin, write: platform admin only) ──
  app.get("/api/settings", requireAuth, requireRole(["admin"]), async (_req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch {
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.get("/api/settings/:key", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const setting = await storage.getSystemSetting(req.params.key);
      if (!setting) return res.status(404).json({ message: "System setting not found" });
      res.json(setting);
    } catch {
      res.status(500).json({ message: "Failed to fetch system setting" });
    }
  });

  app.post("/api/settings", requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
      const validated = insertSystemSettingSchema.parse(req.body);
      const setting = await storage.setSystemSetting(
        validated.settingKey,
        validated.settingValue,
        validated.description || undefined,
        validated.settingType || "string",
      );
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid setting data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update system setting" });
    }
  });

  app.put("/api/settings/:key", requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
      const validated = insertSystemSettingSchema.parse({
        ...req.body,
        settingKey: req.params.key,
      });
      const setting = await storage.setSystemSetting(
        validated.settingKey,
        validated.settingValue,
        validated.description || undefined,
        validated.settingType || "string",
      );
      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid setting data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update system setting" });
    }
  });

  app.delete("/api/settings/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
    try {
      await storage.deleteSystemSetting(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting system setting:", error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to delete system setting",
      });
    }
  });

  // ── "What's New" Changelog (no AI; structured fallback only) ──
  app.get("/api/changelog/whats-new", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user?.primaryTenantId;

      const currentVersion = await storage.getSystemSettingValue("CURRENT_CHANGELOG_VERSION", "");
      if (!currentVersion) return res.json({ showModal: false });

      if (tenantId) {
        const tenant = await storage.getTenant(tenantId);
        if (tenant && tenant.showChangelogOnLogin === false) {
          return res.json({ showModal: false });
        }
      }

      const userRecord = await storage.getUser(user.id);
      if (userRecord?.lastDismissedChangelogVersion === currentVersion) {
        return res.json({ showModal: false });
      }

      const cacheKey = `CHANGELOG_SUMMARY_${currentVersion}`;
      const cachedSummary = await storage.getSystemSettingValue(cacheKey, "");
      if (cachedSummary) {
        try {
          const parsed = JSON.parse(cachedSummary);
          return res.json({ showModal: true, version: currentVersion, ...parsed });
        } catch {
          return res.json({
            showModal: true,
            version: currentVersion,
            summary: cachedSummary,
            highlights: [],
          });
        }
      }

      const changelogContent = readChangelogContent();
      if (!changelogContent) {
        return res.json({
          showModal: true,
          version: currentVersion,
          summary: "New updates are available!",
          highlights: [],
        });
      }

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const versionBlocks = changelogContent.split(/(?=###\s+Version\s+)/);
      const recentSections: string[] = [];
      for (const block of versionBlocks) {
        const dateMatch = block.match(
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/,
        );
        if (dateMatch) {
          const blockDate = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`);
          if (blockDate >= twoWeeksAgo) recentSections.push(block.trim());
        }
      }
      const relevantSection =
        recentSections.length > 0
          ? recentSections.join("\n\n").substring(0, 4000)
          : changelogContent.substring(0, 2000);

      const highlights = extractFallbackHighlights(relevantSection);
      const fallbackResult = {
        summary: "Here's what's new in the latest updates.",
        highlights,
      };
      if (highlights.length > 0) {
        await storage.setSystemSetting(
          cacheKey,
          JSON.stringify(fallbackResult),
          `Structured changelog summary for ${currentVersion}`,
          "json",
        );
      }
      res.json({ showModal: true, version: currentVersion, ...fallbackResult });
    } catch (error: any) {
      console.error("[CHANGELOG] Failed to check changelog status:", error);
      res.status(500).json({ message: "Failed to check changelog status" });
    }
  });

  app.post("/api/changelog/dismiss", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { version } = req.body;
      if (!version || typeof version !== "string") {
        return res.status(400).json({ message: "Version is required" });
      }
      await storage.updateUser(user.id, { lastDismissedChangelogVersion: version });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CHANGELOG] Failed to dismiss changelog:", error);
      res.status(500).json({ message: "Failed to dismiss changelog" });
    }
  });

  // ── SSO ──
  app.get("/api/auth/sso/status", async (_req, res) => {
    try {
      res.json({ configured: isEntraConfigured, enabled: isEntraConfigured });
    } catch (error) {
      console.error("SSO status error:", error);
      res.status(500).json({ message: "Failed to get SSO status" });
    }
  });

  app.get("/api/auth/sso/login", async (_req, res) => {
    try {
      if (!msalInstance) return res.status(503).json({ message: "SSO not configured" });
      const authUrl = await msalInstance.getAuthCodeUrl(authCodeRequest);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("[SSO-LOGIN] Failed to generate auth URL:", error?.message);
      res.status(500).json({ message: "Failed to initiate SSO login" });
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      if (!msalInstance) return res.redirect("/?error=sso_not_configured");

      const { code, error } = req.query;
      if (error) return res.redirect(`/?error=${error}`);
      if (!code || typeof code !== "string") return res.redirect("/?error=missing_auth_code");

      const tokenResponse = await msalInstance.acquireTokenByCode({ ...authCodeRequest, code });
      if (!tokenResponse?.account) return res.redirect("/?error=no_account");

      const userEmail = tokenResponse.account.username;
      const azureAdTenantId = tokenResponse.account.tenantId;
      const azureAdObjectId = tokenResponse.account.localAccountId;

      const [foundUser] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${userEmail})`);
      let activeUser = foundUser;

      if (!activeUser) {
        const emailDomain = userEmail.split("@")[1]?.toLowerCase();
        if (!emailDomain) return res.redirect("/?error=invalid_email");

        const allTenants = await db.select().from(tenants);
        let matchingTenant =
          allTenants.find((t) => t.azureTenantId === azureAdTenantId) ?? null;
        const isPublicDomain = isPublicEmailDomain(userEmail);
        if (!matchingTenant && !isPublicDomain) {
          matchingTenant =
            allTenants.find((t) => {
              const domains = (t.allowedDomains as string[] | null) ?? [];
              return domains.includes(emailDomain);
            }) ?? null;
        }

        let newUserRole = "employee";

        if (!matchingTenant) {
          const [blocked] = await db
            .select()
            .from(blockedDomains)
            .where(eq(blockedDomains.domain, emailDomain));
          if (blocked) return res.redirect("/?error=domain_blocked");

          const [defaultPlan] = await db
            .select()
            .from(servicePlans)
            .where(and(eq(servicePlans.isDefault, true), eq(servicePlans.isActive, true)));
          const planId = defaultPlan?.id ?? null;
          const now = new Date();
          const planExpiresAt = defaultPlan?.trialDurationDays
            ? new Date(now.getTime() + defaultPlan.trialDurationDays * 24 * 60 * 60 * 1000)
            : null;

          const { randomUUID } = await import("crypto");

          if (isPublicDomain) {
            const userName = userEmail.split("@")[0];
            const slug = `user-${randomUUID().substring(0, 8)}`;
            const [newTenant] = await db
              .insert(tenants)
              .values({
                name: `${userName}'s Organization`,
                slug,
                allowedDomains: [],
                selfServiceSignup: true,
                signupCompletedAt: now,
                servicePlanId: planId,
                planStartedAt: now,
                planExpiresAt,
                planStatus: planExpiresAt ? "trial" : "active",
                inviteOnly: true,
                azureTenantId: null,
                allowLocalAuth: false,
              })
              .returning();
            matchingTenant = newTenant;
          } else {
            const companyName = emailDomain.split(".")[0];
            const capName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
            let slug = emailDomain
              .replace(/[^a-z0-9]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");
            const [existingSlug] = await db.select().from(tenants).where(eq(tenants.slug, slug));
            if (existingSlug) slug = `${slug}-${randomUUID().substring(0, 6)}`;
            const [newTenant] = await db
              .insert(tenants)
              .values({
                name: `${capName} (${emailDomain})`,
                slug,
                allowedDomains: [emailDomain],
                selfServiceSignup: true,
                signupCompletedAt: now,
                servicePlanId: planId,
                planStartedAt: now,
                planExpiresAt,
                planStatus: planExpiresAt ? "trial" : "active",
                inviteOnly: false,
                azureTenantId: azureAdTenantId ?? null,
                allowLocalAuth: false,
              })
              .returning();
            matchingTenant = newTenant;
          }

          newUserRole = "admin";
        } else if (matchingTenant.inviteOnly === true) {
          const tenantNameEncoded = encodeURIComponent(matchingTenant.name);
          return res.redirect(`/?error=invite_only&tenant_name=${tenantNameEncoded}`);
        }

        const localPart = userEmail.split("@")[0];
        const nameParts = localPart.split(/[._-]/);
        const inferredName = nameParts
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");
        const initials =
          nameParts.map((p) => p[0]?.toUpperCase() ?? "").join("").substring(0, 2) || "U";

        const [newUser] = await db
          .insert(users)
          .values({
            email: userEmail.toLowerCase(),
            name: inferredName,
            initials,
            role: newUserRole,
            canLogin: true,
            isActive: true,
            primaryTenantId: matchingTenant.id,
            platformRole: "user",
            authProvider: "entra",
            azureObjectId: azureAdObjectId ?? null,
          })
          .returning();

        await db.insert(tenantUsers).values({
          userId: newUser.id,
          tenantId: matchingTenant.id,
          role: newUserRole,
          status: "active",
          joinedAt: new Date(),
        });

        activeUser = newUser;
        console.log(
          `[SSO-CALLBACK] JIT provisioned ${userEmail} → tenant ${matchingTenant.id}`,
        );
      } else {
        if (azureAdObjectId && !activeUser.azureObjectId) {
          await db
            .update(users)
            .set({ azureObjectId: azureAdObjectId, authProvider: "entra" })
            .where(eq(users.id, activeUser.id));
        }
        if (azureAdTenantId && activeUser.primaryTenantId) {
          const [userTenant] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, activeUser.primaryTenantId))
            .limit(1);
          if (userTenant && !userTenant.azureTenantId) {
            await db
              .update(tenants)
              .set({ azureTenantId: azureAdTenantId })
              .where(eq(tenants.id, userTenant.id));
          }
        }
      }

      const { createSession } = await import("./session-store.js");
      const crypto = await import("crypto");
      const sessionId = crypto.randomUUID();

      let extractedRefreshToken: string | null = null;
      try {
        const cacheContents = msalInstance.getTokenCache().serialize();
        const cacheJson = JSON.parse(cacheContents);
        const refreshTokens = cacheJson.RefreshToken || {};
        const rtKeys = Object.keys(refreshTokens);
        if (rtKeys.length > 0) {
          const homeAccountId = tokenResponse.account?.homeAccountId;
          const matchingKey = homeAccountId
            ? rtKeys.find((k) => refreshTokens[k].home_account_id === homeAccountId)
            : rtKeys[rtKeys.length - 1];
          const rtEntry = refreshTokens[matchingKey || rtKeys[rtKeys.length - 1]];
          extractedRefreshToken = rtEntry?.secret || null;
        }
      } catch {
        /* ignore */
      }

      const ssoData = {
        provider: "azure-ad",
        accessToken: tokenResponse.accessToken,
        refreshToken: extractedRefreshToken,
        tokenExpiry: tokenResponse.expiresOn || new Date(Date.now() + 3600 * 1000),
      };

      await createSession(
        sessionId,
        {
          id: activeUser.id,
          email: activeUser.email,
          name: activeUser.name,
          role: activeUser.role,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
        ssoData,
      );

      res.redirect(`/?sessionId=${sessionId}`);
    } catch (error: any) {
      console.error("[SSO-CALLBACK] Fatal error:", error?.message);
      res.redirect("/?error=sso_failed");
    }
  });

  app.post("/api/auth/sso/refresh", requireAuth, handleTokenRefresh);

  // Token-refresh middleware AFTER public SSO endpoints
  app.use("/api/*", checkAndRefreshToken);

  // ── Public page analytics ──
  app.post("/api/analytics/pageview", async (req, res) => {
    try {
      const { path, sessionId, referrer } = req.body || {};
      if (!path || typeof path !== "string")
        return res.status(400).json({ message: "path required" });
      const allowedPaths = ["/", "/signup", "/login"];
      if (!allowedPaths.includes(path))
        return res.status(400).json({ message: "path not tracked" });
      await db.insert(pageViews).values({
        path,
        sessionId: sessionId ? String(sessionId).slice(0, 128) : null,
        referrer: referrer ? String(referrer).slice(0, 512) : null,
        userAgent: req.headers["user-agent"]?.slice(0, 512) ?? null,
      });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[ANALYTICS] pageview record failed:", error);
      res.status(500).json({ message: "Failed to record pageview" });
    }
  });

  app.get(
    "/api/analytics/pageviews",
    requireAuth,
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const days = Math.min(parseInt(String(req.query.days || "30")), 365);
        const since = new Date(Date.now() - days * 86400_000);
        const rows = await db
          .select({
            path: pageViews.path,
            visits: sql<number>`cast(count(*) as integer)`,
            uniqueSessions: sql<number>`cast(count(distinct ${pageViews.sessionId}) as integer)`,
            lastSeen: sql<string>`max(${pageViews.createdAt})`,
          })
          .from(pageViews)
          .where(gte(pageViews.createdAt, since))
          .groupBy(pageViews.path)
          .orderBy(desc(sql`count(*)`));
        res.json({ days, since: since.toISOString(), rows });
      } catch (error: any) {
        console.error("[ANALYTICS] pageviews summary failed:", error);
        res.status(500).json({ message: "Failed to fetch pageviews" });
      }
    },
  );
}
