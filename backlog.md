# Palomar Product Backlog

**Last Updated**: May 19, 2026
**Version**: 6.3 — Centralized Ticket Capture promoted to top P1 per clearing-house vision (signals from Orion, Constellation, and other sibling apps). See `P1_GAPS.md` for the underlying audit.

---

## 🔝 Top Priority — Centralized Ticket Capture (Clearing House)

**Status:** Inbound ingest partially shipped; idempotency, back-sync, and correlation are gaps
**Effort:** High (4 phases, ~6–8 weeks to full scope)
**Why:** Palomar's vision is to be the centralized synchronized clearing house that receives support signals from sibling apps (Orion, Constellation, and future Synozur products). Today sibling apps can POST tickets via API key, but retries duplicate tickets, status changes don't sync back to the source app, and there's no automatic correlation when two apps file tickets about the same incident. Closing these gaps is what makes Palomar a clearing house instead of a forwarder.

### Phase 1 — Idempotent Ingest **[P1]**
**Effort:** Small (3–5 days)
- [ ] Add `externalReferenceId` as a top-level column on `support_tickets` (today it's buried in `metadata` JSONB at `server/routes/support-external.ts:79-81`)
- [ ] Unique constraint on `(tenantId, applicationSource, externalReferenceId)` where `externalReferenceId IS NOT NULL`
- [ ] In `POST /api/external/v1/support/tickets`: lookup on `externalReferenceId` before insert; on hit return existing ticket with HTTP 200 + `idempotent: true` envelope flag (mirrors the old MCP write envelope shape)
- [ ] Optionally accept `Idempotency-Key` HTTP header as a second dedup path
- [ ] Migration + drizzle schema update + integration test covering replay

### Phase 2 — Outbound Webhooks to Source Apps **[P1]**
**Effort:** Medium (2–3 weeks)
- [ ] New table `support_app_webhook_subscriptions` `(tenantId, appIntegrationKeyId, callbackUrl, secret, events text[], active, createdAt)`
- [ ] New table `support_webhook_deliveries` for retry / observability `(id, subscriptionId, ticketId, event, payload jsonb, status, attempts, lastError, nextAttemptAt, deliveredAt)`
- [ ] Emit events from existing write paths in `routes/support.ts` and `routes/support-admin.ts`: `ticket.created`, `ticket.status_changed`, `ticket.replied`, `ticket.merged`, `ticket.resolved`, `ticket.sla_breached`, `ticket.assigned`
- [ ] HMAC sign deliveries with per-subscription secret
- [ ] Exponential backoff retry; dead-letter after N attempts
- [ ] Admin UI showing delivery health per integration key (which sibling apps are unreachable)
- [ ] OpenAPI / docs updated for the outbound contract sibling apps must implement

### Phase 3 — Automatic Cross-Source Correlation **[P1]**
**Effort:** Medium (1–2 weeks)
- [ ] Correlation pass on ingest: auto-create `supportTicketLinks` row with `linkType = 'related'` when two tickets share `externalReferenceId`, or share normalized requester email + subject within a configurable time window
- [ ] Optional fingerprint correlation when `metadata.errorSignature` (stack hash + error class + route) matches
- [ ] Emit `ticket.linked` event through the Phase 2 webhook pipe
- [ ] Surface linked tickets prominently on the ticket detail page in `client/src/pages/support.tsx` (the data is available at `/api/support/tickets/:id/links` but not rendered)

### Phase 4 — Cross-App Signal Ingest (Beyond Tickets) **[P1]**
**Effort:** Medium-High (2–3 weeks; benefits from a design doc first)
- [ ] New table `app_signals` (or extend `supportEvents`) — `(id, tenantId, appIntegrationKeyId, applicationSource, signalType, externalReferenceId, occurredAt, severity, payload jsonb, ticketId nullable)`. Today `supportEvents` is KB-deflection only.
- [ ] New endpoint `POST /api/external/v1/support/signals` (batch-accepting) for sibling apps to push errors, deploys, alerts, customer-health changes
- [ ] On ticket ingest, look back N minutes of `app_signals` for same source + customer and attach as "related events" to the ticket
- [ ] Admin view overlaying signal volume on the ticket-volume timeline so spikes are obvious
- [ ] Document the signal types and payload shapes for sibling apps to publish against

### Explicit Non-Goals for v1
Federated identity across source apps (matching same user across Orion + Constellation tenants), KB cross-publishing to sibling apps, bulk backfill ingest of historical tickets, real-time bidirectional ticket-content sync (replies in source app reflected in Palomar without separate API call).

### Reference
- Audit and rationale: `P1_GAPS.md`
- Current ingest entry point: `server/routes/support-external.ts:71-155`
- Schema today: `shared/schema.ts` — `supportTickets`, `supportAppIntegrationKeys`, `supportTicketLinks`, `supportEvents`

---

## 🆕 In Progress — Copilot Agent Write Activities

**Status:** Phase 0 complete; Phases 1–2 shipped for clients
**Effort:** High (6 phases total, ~8–10 weeks to full scope)
**Design:** `/root/.claude/plans/recursive-squishing-tower.md` (planning artifact) + this backlog section

### Why
The MCP server and Copilot Studio agent are currently read-only. Users asking the agent "start an estimate for Acme Corp — block of 120 hours" get routed back to the web UI. Adding a narrow, safe write surface unlocks conversational productivity for the highest-frequency consulting workflow: estimation.

### Phase 0 — Write Infrastructure ✅ COMPLETE (April 12, 2026)
- [x] `mcp_write_audit` table (tenant, user, endpoint, idempotency key, request hash, response body, resource, dry-run flag, correlation ID)
- [x] `mcpWriteGuard` middleware: `MCP_WRITES_ENABLED` feature flag, `X-Idempotency-Key` header requirement with replay-cache, request-hash conflict detection, `?dryRun=true` universal short-circuit, envelope wrapper (`idempotent`, `auditId`, `correlationId`, `dryRun`)
- [x] New `/server/routes/mcp-write.ts` module, `/mcp/v1/*` namespace registered in `server/routes.ts`
- [x] Write role constants stricter than read (admin, pm, portfolio-manager only — dropped executive and billing-admin for writes)
- [x] `POST /mcp/v1/ping` diagnostic endpoint for the full write stack
- [x] OpenAPI spec updated to v1.1.0 with write paths and `X-Idempotency-Key` header
- [x] `MCP_CONNECTOR_SETUP.md` — removed READ-ONLY language; added Part 4 (write activities) covering feature flag, idempotency, dry-run, envelope, role policy, canonical agent flow

### Phase 1 — Client Discovery ✅ COMPLETE (April 12, 2026)
- [x] `GET /mcp/clients?search=&limit=` — case-insensitive substring match on name + shortName
- [x] Linkage signals in response: `hasHubspotLink` (from `crm_object_mappings`), `hasTeamsLink` (from `client_teams` or legacy `clients.microsoftTeamId`), `activeEstimateCount` (draft/sent/approved estimates)
- [x] Scoped to caller's tenant, role-gated via `ESTIMATE_ROLES`

### Phase 2 — Client Creation ✅ COMPLETE (April 12, 2026)
- [x] `POST /mcp/v1/clients` with Zod validation, tenant from auth context (body `tenantId` ignored)
- [x] Near-match duplicate detection (normalize + substring + Levenshtein) against existing clients in tenant — returns 409 with candidates unless `force: true`
- [x] Shared `insertClientSchema` validation consistent with `/api/clients`

### Phase 3 — Estimate Creation (3 variants) ✅ COMPLETE
**Effort:** Medium (2–3 weeks)
- [x] `POST /mcp/v1/estimates/from-narrative` — AI-generated 3–8 summary line items (hard cap)
- [x] `POST /mcp/v1/estimates/block-hours` — single line item, blended rate via role catalog lookup
- [x] `POST /mcp/v1/estimates/fixed-price` — `estimateType: fixed`, one line per phase
- [x] Uses existing `aiService.generateEstimateFromNarrative()` in `server/services/ai-service.ts`
- [x] Pre-create duplicate check for active estimates on the same client (409 unless `force: true`)
- [x] `createEstimateCore()` helper in `server/routes/mcp-write.ts`
- [x] Prompt-injection sanitization on the `narrative` field (`sanitizeNarrative()`)

### Phase 4 — HubSpot Linkage ✅ COMPLETE
**Effort:** Small-Medium (1–2 weeks)
- [x] `GET /mcp/v1/hubspot/search?type=company|deal&query=`
- [x] `POST /mcp/v1/clients/:clientId/hubspot-link` with `createIfMissing` flag — writes `crm_object_mappings`, uses `createHubSpotDeal()` / `createHubSpotCompany()` from `hubspot-client.ts`

### Phase 5 — Teams Team + Channel Linkage ✅ COMPLETE
**Effort:** Medium (2 weeks)
- [x] `POST /mcp/v1/clients/:clientId/teams-link` — ensures `client_teams` row (creates team via Graph when `createIfMissing`)
- [x] `POST /mcp/v1/projects/:projectId/teams-channel` — ensures `project_channels` row via `plannerService.createChannel()`
- [x] Partial-failure envelope: `warnings[]` preserved; no rollback of prior successful steps

### Phase 6 — Docs, Agent Instructions, Rollout
- [x] OpenAPI spec updated for each phase (bumped to v1.2.0 for Phase 3-5)
- [x] Connector setup doc updated with write-flow agent instructions (Phase 0)
- [ ] `USER_GUIDE.md` — new "Conversational Estimate Creation" section (gated on Phase 3)
- [ ] Enable `MCP_WRITES_ENABLED=true` in staging for pilot tenant(s) after Phase 3

### Explicit Non-Goals for v1
Estimate approval/status transitions, invoice generation, line-item-level edits (would defeat the agent metaphor), project creation (use existing approve-estimate flow), user/role management, expense submission.

---

## ✅ Recently Completed (March 15, 2026)

### Teams Custom Tab Integration ✅ COMPLETE
- [x] Embed routes (`/embed/*`) with chromeless layout
- [x] Tab deep-linking via `?tab=` for all project tabs
- [x] Read-only enforcement — all mutating actions hidden in embed mode
- [x] Teams SSO authentication with popup sign-in flow
- [x] Configurable tab setup page and embed dashboard
- [x] Teams app manifest (`teams/manifest.json`)
- [x] Three-app Entra architecture (SCDP-Content, MCP Connector, Copilot Agent)

### Navigation Reorganization ✅ COMPLETE
- [x] Sub-group labels in sidebar (Daily Work, Time & Expenses, Tracking, etc.)
- [x] Disambiguated menu labels (Dashboard → My Dashboard, Time → Timesheets, etc.)
- [x] Mobile navigation updated to match desktop
- [x] Reordered items for better workflow grouping

### Theme System ✅ COMPLETE
- [x] Modular CSS variable-based theme architecture
- [x] Aurora theme (warm earth tones)
- [x] Night Sky theme (deep navy with star navigation)
- [x] Navigator's Chart theme (clean professional teal)
- [x] Theme integration guide at `docs/SYNOZUR_THEME_GUIDE.md`

---

## ✅ Previously Completed (March 10, 2026)

### MCP Server & Palomar Copilot Agent ✅ COMPLETE
- [x] MCP server with ~24 read-only GET endpoints under `/mcp`
- [x] Bearer token authentication via JWKS (v1 + v2 Entra token issuers)
- [x] Multi-tenant support (Entra `common` authority)
- [x] RBAC-enforced access with tenant-scoped data isolation
- [x] Power Platform Custom Connector with OpenAPI spec import
- [x] Copilot Studio agent for conversational access through Teams and M365 Copilot
- [x] Teams channel deployment for chat and channel-based interactions
- [x] Connector setup guide (`docs/MCP_CONNECTOR_SETUP.md`)
- [x] Endpoint reference (`docs/MCP_README.md`)

### Persistent Status Reports ✅ COMPLETE
- [x] `status_reports` table migrated to database
- [x] AI-generated text reports auto-saved on generation
- [x] PPTX export creates "final" status report record
- [x] Status Reports tab on project detail page with list view
- [x] View report content, mark as final, delete reports
- [x] Full CRUD API at `/api/projects/:projectId/status-reports`
- [x] MCP endpoints for saved status reports (list + detail)
- [x] Project ownership and tenant isolation enforcement on all routes

### AI Model Upgrade ✅ COMPLETE
- [x] Azure AI Foundry integration with GPT-5.4 support
- [x] Multi-provider AI architecture (Replit AI + Azure AI Foundry)
- [x] Configurable model selection per request
- [x] Usage logging and cost tracking per tenant

### SharePoint Embedded Document Storage ✅ COMPLETE
- [x] Full SharePoint Embedded (SPE) integration as primary document storage tier
- [x] Per-tenant SPE container provisioning with Azure AD tenant isolation
- [x] Smart storage layer directing files based on tenant `speStorageEnabled` flag
- [x] Direct file download via Microsoft Graph API (`downloadFileDirect`)
- [x] File Repository page with document type inference from folder paths
- [x] Expandable metadata panel and file statistics dashboard
- [x] Reorganize Files endpoint to move files from nested to top-level SPE folders
- [x] End-to-end receipt download pipeline for SPE-stored files
- [x] Expense "View Receipt" and invoice receipt bundler using direct Graph API
- [x] Container management interface for administrators
- [x] Custom column support with SharePoint-safe naming conventions
- [x] File stats and document type breakdown fixes

### Program Estimate Type ✅ COMPLETE
- [x] New "Program" estimate type for large-scale engagements
- [x] Week-based staffing blocks (role x weeks x utilization %)
- [x] Gantt timeline view for program blocks
- [x] PM Wizard for guided block creation
- [x] Accordion-based block editor with compact data entry
- [x] Weekly subtotals and totals display
- [x] Auto-populate rates from role catalog
- [x] CSV/Excel import and export for program blocks
- [x] Three-factor contingency system (size, complexity, confidence)
- [x] Week 0 support for pre-project activities

### Portfolio Manager Role ✅ COMPLETE
- [x] New "portfolio-manager" role (6th tier in hierarchy)
- [x] PM-level access to ALL projects (not scoped to assigned projects)
- [x] View-only expense access
- [x] External resource cost rates hidden

### HubSpot CRM Integration ✅ COMPLETE
- [x] Per-tenant OAuth 2.0 connection
- [x] CRM Deals page with date range and deal stage filters
- [x] Estimate-to-deal linking with client names and stages
- [x] Won/Lost deal linking
- [x] Contact search and import from HubSpot
- [x] Company-to-client linking
- [x] Auto-refresh tokens with 5-minute buffer

### Estimate Bug Fixes ✅ COMPLETE
- [x] Cost rate resolution: full precedence chain (manual override → estimate → client → user → role default)
- [x] Copied estimates inherit tenant ID (fixes orphaned estimates)
- [x] Estimate name editing regardless of status
- [x] Stable sort order: week first, then sort order as tiebreaker

---

## ✅ Previously Completed (February 13, 2026)

### RAIDD Log ✅ COMPLETE
- [x] Dedicated RAIDD tab within project detail page
- [x] Five entry types: Risk, Issue, Action Item, Dependency, Decision
- [x] Full lifecycle management, governance rules, Excel export
- [x] AI integration in status reports

### Portfolio RAIDD Dashboard ✅ COMPLETE
- [x] Cross-project RAIDD view with summary cards, filters, grouping, XLSX export

### AI-Powered Project Status Reports ✅ COMPLETE
- [x] AI-generated narrative summaries, weekly/monthly periods, RAIDD integration, copy/download

### "What's New" Changelog Modal ✅ COMPLETE
- [x] AI-generated summaries on login, per-user dismiss tracking, tenant admin toggle, mobile responsive

### Per Diem & Expense Automation ✅ COMPLETE
- [x] GSA Per Diem API (CONUS), OCONUS DoD rates, airport codes, exchange rates, travel day calculations

### Invoice Report Enhancements ✅ COMPLETE
- [x] Client filter, three-year data, YoY comparison, batch type filtering

### Expense Report PDF Export ✅ COMPLETE (Quick Win)

---

## ✅ Previously Completed (January 2026)

### Multi-Tenancy Architecture ✅ COMPLETE (Phases 1-4, 6)
- [x] UUID-based tenant IDs, data isolation, service plans, self-service signup
- [x] Plan lifecycle enforcement, grace periods, scheduled expiration
- [x] Platform admin UI, tenant switcher, automatic assignment
- [ ] Phase 5: Subdomain routing — DEFERRED (needs custom DNS + wildcard SSL)
- [ ] Phase 7: Security audit, data retention enforcement — ONGOING

### Retainer Estimates & Rate Overrides ✅ COMPLETE
### Resource Management & Capacity Planning ✅ COMPLETE
### Financial Reporting ✅ COMPLETE
### Microsoft Planner Integration (Phase 1) ✅ COMPLETE
### Scheduled Jobs System ✅ COMPLETE
### Mobile Web Optimization ✅ COMPLETE
### AI Help Chat & In-App Docs ✅ COMPLETE

---

## 🚨 P1 - HIGH PRIORITY

### Estimate-Level Sharing (Read-Only ACL)
**Status:** Complete
**Effort:** Medium (2-3 days)

- [x] "Share" button on estimates for PMs to invite specific users with read-only access
- [x] New `estimate_shares` table (estimate_id, user_id, granted_by, granted_at)
- [x] Shared estimates appear in the user's estimate list (read-only badge)
- [x] API-level permission checks: shared users can GET estimate data but not POST/PATCH/DELETE
- [x] Cost/chargeback rate columns hidden from shared viewers (API response filtering)
- [x] Share management UI: grant, revoke, view current shares
- [x] Shared viewer sees estimate detail, line items, totals, and Gantt — but not cost rates or margin data
- [x] Read-only banner shown to shared viewers on estimate detail page

### QuickBooks Online Integration
**Status:** Planned — #1 user-requested feature (94 marketplace coins, Feb 2026 feedback)
**Effort:** High (8-12 weeks)

- [ ] OAuth2 authentication with QuickBooks Online
- [ ] Client → QBO Customer mapping interface
- [ ] Role/Service → QBO Items mapping
- [ ] Expense categories → QBO Account mappings
- [ ] Invoice Batch → QBO Invoice (Draft) creation
- [ ] Batch ID deduplication to prevent duplicates
- [ ] Webhook integration for sync status
- [ ] QBO sync dashboard with error reporting
- [ ] Retry mechanism for failed syncs

### Advanced Resource Management
**Status:** Complete — All 6 phases implemented (`docs/design/advanced-resource-management.md`)
**Effort:** High (~7-8 weeks, 6 phases)

- [x] Phase 1: Multi-role capability mapping & per-person capacity profiles
- [x] Phase 2: Planner sync protection for generic roles
- [x] Phase 3: Smart assignment suggestions with cost variance
- [x] Phase 4: Cross-project workload view & rebalancing dashboard
- [x] Phase 5: Capacity planning analytics & KPIs
- [x] Phase 6: Bulk import & polish

### Microsoft 365 Teams Integration
**Status:** Phase 2 complete — SharePoint provisioning, member sync, guest invitations
**Effort:** Medium (2-3 weeks remaining for bidirectional sync & project creation UI)

- [x] Planner one-way sync ✅
- [x] Database schema for Teams/Channels/Planner ✅
- [x] Automatic Team creation for new clients ✅
- [x] Channel creation for subsequent projects ✅
- [x] SharePoint site provisioning with Team ✅ (Phase 2)
- [x] Team member management (add/remove from assignments) ✅ (Phase 2)
- [x] Guest user invitation workflows ✅ (Phase 2)
- [x] Automation audit logging ✅ (Phase 2)
- [ ] Planner Phase 2: Bidirectional sync via Graph webhooks
- [ ] Project creation UI with M365 options

### Codebase Modularization
**Status:** Planned — Pattern established with `platform.ts` extraction
**Effort:** Medium (4-6 weeks)

- [ ] Phase 1: Route extraction (13 domain modules from routes.ts)
- [ ] Phase 2: Storage layer extraction (8 domain modules from storage.ts)
- [ ] Phase 3: Shared middleware & utilities extraction

---

## 📊 P2 - IMPORTANT FEATURES

### Advanced Financial Reporting
**Status:** Partially complete — YoY and client filter done
**Effort:** Medium (4-6 weeks)

- [x] Year-over-year revenue analysis ✅
- [x] Client filter on reports ✅
- [ ] Client contribution analysis and rankings
- [ ] Service line revenue breakdown
- [ ] Revenue forecasting based on pipeline
- [ ] Estimate vs Actual accuracy metrics (portfolio-wide)
- [ ] Variance analysis by project type, client, team member
- [ ] Interactive dashboard with drill-down

### Commercial Schemes: Milestone Fixed Fee
**Status:** Planned
**Effort:** Medium (3-4 weeks)

- [ ] Milestone definition with acceptance criteria
- [ ] Percentage complete tracking
- [ ] Milestone payment scheduling & partial billing
- [ ] Client acceptance workflow with digital sign-off
- [ ] Milestone variance reporting

### Commercial Schemes: Enhanced T&M
**Status:** Planned
**Effort:** Medium (2-3 weeks)

- [ ] Rate calculation at service date
- [ ] Not-to-exceed (NTE) budget tracking with alerts
- [ ] T&M profitability analysis
- [ ] Progress-to-budget real-time reporting

### Pricing Privacy & Rate Management
**Status:** Planned
**Effort:** Medium (2-3 weeks)

- [ ] Separate rack rates (internal) from charge rates (client-facing)
- [ ] Rate margin calculations and reporting
- [ ] Field-level security to hide cost data from non-admin roles
- [ ] Rate grandfathering for existing engagements

### Notifications System
**Status:** Deprioritized per Feb 2026 user feedback
**Effort:** Medium (4-6 weeks)

- [ ] In-app notification center (bell icon, dropdown, full page)
- [ ] Email notifications via SendGrid
- [ ] User preferences with granular per-type controls
- [ ] Time entry reminders, expense approvals, budget alerts, deadline reminders

### Estimate Adjustment Factors - System Defaults
**Status:** Planned
**Effort:** Low (1 week)

- [ ] Admin UI for default Size, Complexity, and Confidence factors
- [ ] Estimate-level override toggle (inherit vs custom)
- [ ] Impact preview before applying changes

### SharePoint Embedded UI ✅ COMPLETE
**Status:** Complete (March 10, 2026)
**Effort:** Medium (3-4 weeks)

- [x] Container management interface
- [x] Document metadata templates and custom columns
- [x] File Repository with document type inference and metadata panel
- [x] Document search with metadata filtering
- [x] File reorganization tools
- [ ] Permission management interface — DEFERRED
- [ ] Bulk document operations — DEFERRED
- [ ] Version history viewer — DEFERRED
- [ ] Document approval workflow — DEFERRED

### Document Management Enhancements
**Status:** Planned
**Effort:** Medium (3-4 weeks)

- [ ] MSA/NDA document tracking with expiration alerts
- [ ] Contract document repository with versioning
- [ ] Document templates library
- [ ] E-signature integration (DocuSign)

### Advanced Dashboard Features
**Status:** Planned
**Effort:** Medium (2-3 weeks)

- [ ] Customizable dashboard widgets
- [ ] Executive dashboard view
- [ ] Drill-down capabilities
- [ ] Scheduled dashboard emails

### Time Tracking UX Improvements
**Status:** Planned
**Effort:** Low (1-2 weeks)

- [ ] User-scoped default view (my time vs all time)
- [ ] Timer-based tracking with start/stop
- [ ] Missing entry detection
- [ ] Persist view preferences per user

### Orphaned Invoice PDF File Cleanup (Task #22)
**Status:** Planned
**Effort:** Low (2-3 days)

Invoice PDF files stored in SharePoint/object storage are never removed when a batch is deleted, and the regeneration path silently swallows delete errors — leaving orphaned and duplicate files accumulating in storage indefinitely.

- [ ] Delete stored PDF automatically when a batch is deleted (hook into `deleteInvoiceBatch()`)
- [ ] Admin endpoint `POST /api/admin/purge-orphan-invoice-pdfs` with `?dryRun=true` support — lists all stored files, cross-references against live `pdfFileId` values, deletes unmatched, returns summary
- [ ] Harden the "delete old version before regenerate" step: replace silent catch with a logged warning (batchId + file ID) so storage failures are visible in production logs
- [ ] Run purge against production after deploy to clear pre-existing orphans

---

## 🤖 P3 - AI & AUTOMATION

### AI-Enhanced Workflows
**Status:** Future
**Effort:** High (8-12 weeks)

- [ ] Receipt OCR with auto-extraction and category prediction
- [ ] Weekly time entry suggestions based on patterns
- [ ] Anomaly and duplicate detection
- [ ] Estimate intelligence: similar project suggestions, risk identification

### MCP Server (Model Context Protocol) ✅ COMPLETE
**Completed:** March 2026 (v1.7) — See "Recently Completed" section above.

### Persistent Status Reports ✅ COMPLETE
**Completed:** March 2026 (v1.7) — See "Recently Completed" section above.

**Future Enhancements (not yet started):**
- [ ] SPE file storage for PPTX reports (currently saved to DB only)
- [ ] Bulk delete option for cleaning up older drafts
- [ ] Auto-archive reports older than N months
- [ ] Scheduled automatic report generation and email delivery

---

## 🔗 P4 - PLATFORM CAPABILITIES (2026+)

### Accounts Payable (AP) - Contractor Payment Management
**Status:** Planned
**Effort:** Very High (8-13 weeks, 6 phases)

- [ ] Contractor invoice submission, matching, and payment tracking
- [ ] Finance menu restructure (AR + AP)
- [ ] PDF upload with SharePoint storage
- [ ] Split-view invoice matching interface
- [ ] Cost rate validation with variance alerts
- [ ] Approval and payment workflow
- [ ] AP reporting (payment history, pending invoices, aging)

### Cloud Deployment Migration: GCP → Azure
**Status:** Planned — Replit engineering task
**Effort:** Medium (coordination with Replit engineering)

- [ ] Migrate Palomar hosting from GCP to Azure infrastructure
- [ ] Coordinate with Replit engineering team for deployment target change
- [ ] Validate all environment variables and secrets transfer correctly
- [ ] Verify database connectivity and performance on Azure
- [ ] Test SharePoint Embedded and Microsoft Graph API latency improvements (same-cloud advantage)
- [ ] Validate AI Foundry endpoint connectivity from Azure-hosted environment
- [ ] Update deployment documentation and runbooks
- [ ] Smoke test all integrations (HubSpot, SendGrid, Outlook, SharePoint) post-migration

### SPE File Lifecycle & Orphan Cleanup
**Status:** Design Required
**Effort:** Medium (3-5 weeks)

- [ ] Design cleanup strategy for SharePoint Embedded files tied to draft or deleted invoices, deleted expenses, and other transient artifacts
- [ ] Identify and catalog all SPE file creation points (invoice PDFs, expense receipts, SOW documents, deliverable attachments, etc.)
- [ ] Define retention policies: which files should be soft-deleted, hard-deleted, or archived when their parent record is removed
- [ ] Build orphan detection service: find SPE files with no matching database record (e.g., invoice PDF exists but batch was deleted, receipt uploaded but expense was removed)
- [ ] Implement periodic cleanup job (scheduled task) to flag or remove orphaned files based on retention rules
- [ ] Consider discoverability impact: ensure deleted/draft artifacts are excluded from MCP and Copilot queries so AI assistants don't surface stale data
- [ ] Add admin UI for reviewing orphaned files before permanent deletion (safety net)
- [ ] Handle edge cases: files referenced by multiple records, files in tenant-specific vs shared containers, migration-era files with null tenantId

### Extended Integrations
**Status:** Future

- [ ] Salesforce CRM integration
- [ ] Xero / NetSuite accounting
- [ ] Slack notifications and commands
- [ ] Jira / Azure DevOps linking

### API Platform
**Status:** Future

- [ ] Public REST API v2 with OpenAPI docs
- [ ] API key management and rate limiting
- [ ] Webhook management
- [ ] Developer portal with SDKs

### Internationalization & Localization
**Status:** Future

- [ ] Multi-language support (Spanish, French, German)
- [ ] Multi-currency with real-time FX
- [ ] Regional compliance (GDPR, local tax)

### Advanced Security & Compliance
**Status:** Future

- [ ] SOC 2 Type II preparation
- [ ] Data retention policies and right-to-be-forgotten
- [ ] Passwordless / FIDO2 authentication

### Client Portal
**Status:** Deprioritized

- [ ] Client project dashboard, invoice viewing, document sharing
- [ ] Change request submission, secure messaging

---

## 📋 SUMMARY

### Active Backlog by Priority

| Priority | Items | Est. Effort |
|----------|-------|-------------|
| P1 - High | 4 items | 24-32 weeks |
| P2 - Important | 10 items | 20-32 weeks |
| P3 - AI/Automation | 2 items | 11-16 weeks |
| P4 - Platform | 7 items | 34+ weeks |

### Notes on Already Implemented Features (NOT in backlog)
- ✅ Expense bulk upload with CSV/Excel
- ✅ MFA via Azure Entra ID
- ✅ Project and estimate milestones
- ✅ Basic burn rate tracking
- ✅ Estimate accuracy reporting
- ✅ Portfolio metrics
- ✅ Time/expense import templates
- ✅ Change order management
- ✅ SOW management
- ✅ Invoice batch PDF generation
- ✅ Financial reports API endpoints
- ✅ Dashboard KPIs
- ✅ Program estimates with Gantt view
- ✅ HubSpot CRM integration
- ✅ Portfolio Manager role
- ✅ Per Diem (CONUS + OCONUS)
- ✅ "What's New" changelog modal
- ✅ AI status reports with RAIDD
- ✅ SharePoint Embedded document storage with File Repository
