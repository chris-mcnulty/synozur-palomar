# Palomar - Synozur Consulting Delivery Platform (SCDP)

## Overview
Palomar is a multi-tenant consulting/delivery management platform focused on the support and SLA-tracked work that consulting practices need around their delivery engagements. The codebase has been stripped down to the essentials: SSO/auth, multi-tenancy, support ticketing (queues, SLAs, KB articles, replies, watchers, activity, Planner sync), system settings, scheduled job tracking, agent card health monitoring, and lightweight analytics.

This is a slim foundation intended to be extended with new domain features. The previous full delivery suite (estimates, projects, time entries, expenses, invoices, deliverables, RAIDD, AI narrative generation, Teams automation, MCP server, CRM sync, etc.) has been removed.

## User Preferences
Preferred communication style: Simple, everyday language.
**CRITICAL**: `attached_assets/` is ONLY for temporary scratch files. NEVER store application assets (logos, images, etc.) there. All permanent assets must live in the source tree (e.g., `client/src/assets/logos/`).
**CRITICAL FONT RULE**: The ONLY font allowed in the application is the **Avenir Next Lt Pro** family. Font files are in `client/public/fonts/`.
**CRITICAL — TENANT DATA BOUNDARY**: Every database query that touches tenant-scoped data MUST include a `tenantId` filter derived from the server-side session (`req.user?.activeTenantId || req.user?.primaryTenantId || req.user?.tenantId`). NEVER trust a `tenantId` value supplied by the client.
**STANDING INSTRUCTION — MERGED PRs**: After every merged PR, inspect all changed files with special attention to: (1) schema changes in `shared/schema.ts` — verify column types, nullability, defaults, and foreign keys are correct; (2) new/modified storage methods in `server/storage.ts` — verify tenantId scoping, no raw SQL injection, correct Drizzle ORM patterns; (3) run `npx drizzle-kit push` if schema changed; (4) check the app starts cleanly and the SLA watcher / agent-card-health schedulers log no errors.

## System Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite.
- **UI**: Radix UI + shadcn/ui + Tailwind CSS.
- **Routing**: `wouter`.
- **Data Layer**: `@tanstack/react-query` v5 with default fetcher in `@/lib/queryClient`.
- **Forms**: `react-hook-form` + `zod` resolvers, using insert schemas from `@shared/schema`.

### Backend
- **Runtime**: Node.js + Express (TypeScript ES modules).
- **API**: RESTful, single-port (Vite dev middleware in development).
- **ORM**: Drizzle ORM (PostgreSQL).
- **Validation**: Zod (with `drizzle-zod` insert schemas).

### Database
- **Type**: PostgreSQL (Neon-compatible).
- **Schema Management**: Drizzle Kit (`drizzle.config.ts` → `migrations/`).
- **Tables (22)**: `service_plans`, `tenants`, `blocked_domains`, `users`, `tenant_users`, `sessions`, `scheduled_job_runs`, `system_settings`, `tenant_microsoft_integrations`, `user_azure_mappings`, `grounding_documents`, `support_queues`, `support_sla_policies`, `support_kb_articles`, `support_app_integration_keys`, `support_tickets`, `support_ticket_replies`, `support_ticket_planner_sync`, `support_ticket_watchers`, `support_ticket_activity`, `agent_card_health_checks`, `page_views`.

### Project Structure
- **Monorepo**: `/client`, `/server`, `/shared`.
- **Storage Layer**: Single-file `server/storage.ts` exposing `IStorage` interface and `DbStorage` implementation. All Drizzle reads/writes go through the `storage` singleton.
- **Routes**: Thin bootstrap in `server/routes.ts` (~700 lines) that mounts:
  - `registerAuthRoutes` (login, logout, signup, session, SSO)
  - 4 support modules (`server/routes/support*.ts`: admin, external API, customer portal, agent UI)
  - Agent-card-health admin endpoints (`/api/admin/agent-card-health`)
  - System settings CRUD (`/api/settings`)
  - Changelog (`/api/changelog/whats-new`, `/api/changelog/dismiss`) — no AI, static fallback
  - SSO config (`/api/auth/sso/*`)
  - Agent.json passthrough (`/.well-known/agent.json`)
  - `/api/environment`, `/api/health` (db-only), `/api/analytics/pageview(s)`

### Authentication & Authorization
- **Production SSO**: Azure AD (Microsoft Entra ID).
- **Development Auth**: Local email/password.
- **Roles**: Tier-based with feature permissions.

### Background Schedulers
- **Agent Card Health** (`server/services/agent-card-health-scheduler.ts`): Hourly check of `/.well-known/agent.json` per tenant; results persisted in `agent_card_health_checks`.
- **SLA Breach** (`server/services/sla-breach-scheduler.ts`): 15-minute interval scan of open support tickets with `slaDueAt` past current time. Stub — extend to send notifications/escalate.

### Notification & Email
- **SendGrid** client in `server/services/sendgrid-client.ts` and `email-notification.ts` for transactional support emails.

### Multi-Tenancy
- UUID tenant IDs, server-side `tenantId` filtering enforced on every query.
- Per-tenant SSO settings via `tenant_microsoft_integrations` and `user_azure_mappings`.

## External Dependencies
- **PostgreSQL** (Neon).
- **Replit Object Storage** (object_storage integration installed).
- **SendGrid** (transactional email).
- **Microsoft Graph / Outlook / SharePoint** (integrations installed; used by Microsoft integration storage rows + Planner sync hook on tickets).
- **HubSpot** (integration installed; available for future support sync).
- **OpenAI** (integration installed; available for future support assist features — currently unused).

## Migrations
- Migration history was reset as part of the strip-down. The current canonical migration is `migrations/0000_init_consulting_essentials.sql`, which drops the full legacy schema and creates the slim 22-table consulting schema. Legacy migration files are archived under `migrations.legacy/`.
- Run `npx drizzle-kit generate` to add new migrations and `npx drizzle-kit migrate` to apply them.

## Workflows
- `Start application` — `npm run dev` (Express + Vite on port 5000).
- `agent-card-sync` — runs `scripts/gen-agent-card.ts --check` and `scripts/validate-agent-card.ts` to keep the static `client/public/.well-known/agent.json` snapshot in sync with `server/a2a/agent-card-data.ts`.

## Forbidden Changes
- Do NOT modify `vite.config.ts`, `server/vite.ts`, `drizzle.config.ts`, or `package.json` scripts. Use the package management tools to install dependencies.

## Support Platform

A multi-tenant support system layered on the slim consulting core:

- **Schema** (`shared/schema.ts`): `supportQueues`, `supportSlaPolicies`, `supportKbArticles`, `supportAppIntegrationKeys`, `supportTicketWatchers`, `supportTicketActivity`, `supportSavedFilters`, `supportRateLimitBuckets`. Tickets carry `ticketType`, `source`, `queueId`, `slaPolicyId`, `firstResponse*`, `resolutionDueAt`, `slaBreached`, `closedAt`, `externalRequester{Email,Name}`, `portalToken`, `appIntegrationKeyId`, and CSAT fields.
- **Internal API** (`server/routes/support.ts`): Authenticated CRUD for staff plus saved-filter CRUD, FTS search (`/api/support/search`), and analytics (`/api/support/analytics`, 60s in-process cache).
- **External API** (`server/routes/support-external.ts`): Bearer/API-key authenticated endpoints for other SYNOZUR apps to file/read tickets, plus `/api/external/v1/support/metrics` returning `{ open, awaitingCustomer, breachRate7d }` scoped to the calling app key.
- **Public Portal** (`server/routes/support-portal.ts`): Token-protected magic-link access (`/portal/ticket/:token`) plus `/api/portal/bootstrap` which returns tenant info and branding (`primaryColor`, `logoUrl`, `pageTitle`, `fromName`, `supportEmail`).
- **Admin Routes** (`server/routes/support-admin.ts`): Tenant-scoped CRUD for queues, SLA policies, KB articles, API keys, watchers, and activity.
- **Inbound Email** (`/api/support/email-inbound`): Authenticates via API key OR HMAC signature (`X-Inbound-Signature` over body using `SUPPORT_INBOUND_EMAIL_SECRET`); tenant always derived from credentials.
- **Search & Observability**: Postgres FTS via generated `tsvector` columns + GIN indexes on `support_tickets` and `support_ticket_replies` (managed at boot by `server/lib/support-fts-migration.ts`). Analytics surface lives at `/support/analytics` (recharts) and consumes the cached endpoint above.
- **Tenant Branding on Mail**: `server/email-support.ts` reads tenant `primaryColor`, `logoUrl`, `supportFromEmail`, and `supportFromName` for confirmation and staff-reply templates.
- **Durable Rate Limiting**: `support_rate_limit_buckets` powers a Postgres sliding-window limiter (`server/lib/support-ratelimit.ts`) used across `/api/portal/*` (per-IP) and `/api/external/v1/*` (per-API-key prefix), replacing the in-memory Map.
