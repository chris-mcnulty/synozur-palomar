# Constellation - Synozur Consulting Delivery Platform (SCDP)

## Overview
Constellation is a multi-tenant consulting/delivery management platform focused on the support and SLA-tracked work that consulting practices need around their delivery engagements. The codebase has been stripped down to the essentials: SSO/auth, multi-tenancy, support ticketing (queues, SLAs, KB articles, replies, watchers, activity, Planner sync), system settings, scheduled job tracking, agent card health monitoring, and lightweight analytics.

This is a slim foundation intended to be extended with new domain features. The previous full delivery suite (estimates, projects, time entries, expenses, invoices, deliverables, RAIDD, AI narrative generation, Teams automation, MCP server, CRM sync, etc.) has been removed.

## User Preferences
Preferred communication style: Simple, everyday language.
**CRITICAL**: `attached_assets/` is ONLY for temporary scratch files. NEVER store application assets (logos, images, etc.) there. All permanent assets must live in the source tree (e.g., `client/src/assets/logos/`).
**CRITICAL FONT RULE**: The ONLY font allowed in the application is the **Avenir Next Lt Pro** family. Font files are in `client/public/fonts/`.
**CRITICAL — TENANT DATA BOUNDARY**: Every database query that touches tenant-scoped data MUST include a `tenantId` filter derived from the server-side session (`req.user?.activeTenantId || req.user?.primaryTenantId || req.user?.tenantId`). NEVER trust a `tenantId` value supplied by the client.

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
