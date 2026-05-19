# P1 Gap Audit — Code vs. Vision

**Date:** 2026-05-19
**Branch:** `claude/identify-p1-gaps-fFPgU`
**Scope:** Identify Priority 1 functionality gaps — broken/missing features, incomplete flows, stub code — based on the stated product vision.

## Vision (per chat with the product owner, May 19 2026)

> Palomar is the **centralized synchronized clearing house** that receives support signals from other apps like Orion or Constellation.

This is a product **pivot away** from the old "consulting delivery platform" framing that still pervades `CLAUDE.md`, `docs/USER_GUIDE.md`, `backlog.md`, `docs/ROADMAP.md`, and the repo-root planning files. The strip commit `b29bd89` (May 3, 2026 — "Strip Constellation to consulting/delivery-management essentials") plus the subsequent "internal-support hardening" waves (`9b9ef8e`, `5cdefce`) implemented the first half of that pivot. The docs were never updated.

This audit assumes the support / clearing-house direction is the canonical one.

---

## TL;DR

What works today vs. what the vision requires:

| Clearing-house capability | Built | P1 gap |
|---|---|---|
| Sibling app POSTs ticket via API key | ✅ `/api/external/v1/support/tickets` | — |
| Per-app API key auth + rate limit | ✅ `supportAppIntegrationKeys` + `externalRateLimit` | — |
| Track which app filed a ticket | ✅ `supportTickets.applicationSource` + `appIntegrationKeyId` | — |
| Sibling app fetches ticket status | ✅ `GET /api/external/v1/support/tickets/:id` | — |
| Sibling app posts reply | ✅ `POST /tickets/:id/replies` | — |
| **Idempotent ingest (no duplicate tickets on retry)** | ❌ | **P1** |
| **External reference ID as a queryable column** | ❌ (buried in `metadata` JSONB) | **P1** |
| **Outbound webhook → sync status back to source app** | ❌ none | **P1** |
| **Automatic cross-source correlation / dedup** | ❌ only manual `supportTicketLinks` | **P1** |
| **Cross-app signal ingest beyond tickets (errors, deploys, alerts)** | ❌ `supportEvents` is KB-deflection only | **P1** |
| **Bulk / batch ingest for backfill** | ❌ one-at-a-time only | **P2** |
| **Per-source-app metrics + queue health view** | ⚠️ stub at `/api/external/v1/support/metrics` (returns from `s` but not source-scoped) | **P2** |
| **Federated requester identity across source apps** | ⚠️ matches by email within tenant only | **P2** |
| **Cross-publishing of KB to source apps** | ❌ portal KB exists; no external read API | **P2** |
| **Docs describe the clearing-house product** | ❌ CLAUDE.md / USER_GUIDE.md / backlog / ROADMAP all describe the old consulting product | **P1** |

The nine support-product P1s I found independently (auth, tenant isolation, stubs) are at the bottom — they're real and worth fixing regardless.

---

## The P1 gaps, in priority order

### P1.1 — Idempotent ingest by `(applicationSource, externalReferenceId)`

**File:** `server/routes/support-external.ts:71-155`
**Today:** The POST handler accepts `externalReferenceId` and tucks it into `metadata.externalReferenceId` JSONB. It is **not a column**, **not indexed**, **not unique**, and the handler does **not check** whether a ticket with that external ref already exists for that app key.

**Why this is P1:** A clearing house lives or dies on idempotency. Orion's webhook delivery will retry on transient errors. Constellation's batch sync will replay. Without idempotency, every retry creates a duplicate ticket — and once duplicates exist, you can never reconcile state with the source.

**Fix shape:**
- Add `externalReferenceId` as a top-level column on `support_tickets` (text, nullable).
- Add a unique constraint on `(tenantId, applicationSource, externalReferenceId)` where `externalReferenceId IS NOT NULL`.
- In the POST handler: if `externalReferenceId` is provided, look up first; on hit, return the existing ticket envelope with HTTP 200 (not 201) and an `idempotent: true` flag.
- Optionally accept `Idempotency-Key` HTTP header as a second deduplication path (envelope-level rather than entity-level).

### P1.2 — Outbound webhooks to source apps

**Files:** none yet (no webhook config table, no delivery code, no retry queue).
**Today:** Inbound only. When the support team resolves a ticket originally filed by Orion, Orion has no way to know unless it polls `GET /tickets/:id`. For a "synchronized" clearing house this is the single biggest gap.

**Why this is P1:** "Synchronized" is in the vision statement. One-way sync is not synchronization. Source apps need to react to status changes (e.g., Orion wants to surface "your bug report has been resolved" to the user who filed it).

**Fix shape:**
- New table `support_app_webhook_subscriptions`: `(tenantId, appIntegrationKeyId, callbackUrl, secret, events text[], active, createdAt)`.
- New table `support_webhook_deliveries`: `(id, subscriptionId, ticketId, event, payload jsonb, status, attempts, lastError, nextAttemptAt, deliveredAt)` for retry / observability.
- Emit events from existing write paths in `routes/support.ts` and `routes/support-admin.ts`: `ticket.created`, `ticket.status_changed`, `ticket.replied`, `ticket.merged`, `ticket.resolved`, `ticket.sla_breached`, `ticket.assigned`. (Most of these already log to `supportTicketActivity` — emit alongside it.)
- HMAC sign deliveries with the per-subscription secret; exponential backoff retry; dead-letter after N attempts.
- Surface delivery health on the integration-keys admin page so operators can see which sibling apps are unreachable.

### P1.3 — Automatic cross-source correlation / dedup

**File:** `server/routes/support-links.ts` (manual link CRUD only).
**Today:** `supportTicketLinks` lets a human link two tickets. There is no automatic correlation when two source apps file tickets about the same underlying issue.

**Why this is P1:** The clearing-house pitch is "Orion and Constellation users both hit the same bug — Palomar shows you one merged conversation." Without auto-correlation the clearing house is just a forwarder.

**Fix shape:**
- Correlation pass on ingest: if two tickets within the same tenant share `externalReferenceId` OR share requester email + subject normalized + occurred within a configurable window, auto-create a `linkType = 'related'` link and emit a `ticket.linked` webhook.
- Optional: fingerprint correlation for tickets carrying structured error payloads in `metadata.errorSignature` (stack hash, error class, request route).
- UI: show linked tickets prominently on the ticket detail page (today it's only at `/api/support/tickets/:id/links`, which exists but isn't shown in `client/src/pages/support.tsx`'s ticket view — verify).

### P1.4 — Cross-app signal ingest beyond tickets

**Today:** `supportEvents` table exists with columns `(tenantId, eventType, articleId, sessionId, metadata)` — purely sized for KB deflection events. The clearing-house vision implies sibling apps push **all** their support-relevant signals here: production errors, deploys, feature flag flips, customer-health scores, churn risk, NPS verbatims.

**Why this is P1:** Tickets are the lagging indicator. The clearing-house value compounds when it can correlate a ticket spike to a deploy 12 minutes earlier, or attach a customer-health score to a ticket on open. Without a signal table, that intelligence is impossible.

**Fix shape:**
- New table `app_signals` (or repurpose `supportEvents` with added columns): `(id, tenantId, appIntegrationKeyId, applicationSource, signalType, externalReferenceId, occurredAt, severity, payload jsonb, ticketId nullable)`.
- New endpoint `POST /api/external/v1/support/signals` (batch-accepting) for sibling apps to push events.
- Correlation: on ticket ingest, look back N minutes of `app_signals` for the same source + customer and attach them to the ticket as "related events."
- Admin view that overlays signal volume on the ticket volume timeline.

### P1.5 — Documentation rewrite for the clearing-house product

These files actively mislead any human or agent (including future Claude sessions) that touches the repo:

| File | Problem |
|---|---|
| `CLAUDE.md` | "What This App Is: A comprehensive consulting project lifecycle platform: estimation, resource allocation, time tracking, expense management, and automated invoice generation." All 15 bullet "Key Features" describe code that no longer exists. |
| `docs/USER_GUIDE.md` (v1.7) + `client/public/docs/USER_GUIDE.md` mirror | Entire guide describes the consulting product. |
| `docs/ROADMAP.md` | Q2 2026 priorities (Advanced Commercial Schemes, T&M, GCP→Azure, Advanced Financial Reporting) are all consulting-product. |
| `backlog.md` (v6.2) | "Copilot Write Activities Phase 0-3 ✅ COMPLETE" — the code was deleted on May 3. QBO, M365 Teams, Codebase Modularization P1s are all consulting-era. |
| `docs/CHANGELOG.md` | No entry for the May 3 pivot or the support hardening waves. |
| `FILE_MIGRATION_PLAN.md`, `PENDING_RECEIPTS_VERIFICATION_REPORT.md`, `SMART_STORAGE_SUMMARY.md` | Describe receipts / invoices / contracts that don't exist. |
| `SHAREPOINT_PERMISSIONS_SETUP.md`, `AZURE_APP_PERMISSIONS_SETUP.md`, `VOCABULARY_TESTING_GUIDE.md`, `PRODUCTION_DEPLOYMENT_FIX.md`, `notifications-plan.md`, `replit.md`, `test.md` | Mix of stale + consulting-era. |
| `server/routes.ts.backup` (6,596 lines) | The pre-strip consulting code, sitting on the working tree. Will pollute IDE search, security scans, and any "grep for routes" sweep. |
| `docs/AI_ESTIMATE_GROUNDING.md`, `docs/SYNOZUR_THEME_GUIDE.md`, `docs/MCP_CONNECTOR_SETUP.md`, `docs/MCP_README.md`, `docs/constellation-mcp-openapi.json`, `docs/user-guide/`, `docs/design/` | Mostly consulting-era. |

**Why this is P1:** Every future change in this repo gets harder if the docs lie. Every agent session starts from a false premise. The risk isn't aesthetic — it's that someone (human or AI) trusts the backlog claim that "MCP Write Phase 3 is complete" and builds the next thing on top of a phantom layer.

**Fix shape:**
1. Rewrite `CLAUDE.md` first. New "What This App Is" sentence: "*Palomar is a centralized synchronized clearing house that receives support signals from sibling apps (Orion, Constellation) and provides unified ticket tracking, SLA enforcement, knowledge-base deflection, and bidirectional status sync.*" Rewrite Key Features section to match what's actually in code. Drop "Auth", "Multi-Tenancy", "Document Storage" sections only if they no longer apply; otherwise update.
2. Rewrite `docs/USER_GUIDE.md` for the support workflows that actually ship (portal, KB, queues, SLA policies, KB analytics, support console, agent assignment, ticket linking).
3. Rewrite `backlog.md` to reflect actual state: shipped (support waves 1-3, portal, KB, SLA cron), in progress (?), planned (P1.1-P1.4 above + the user-facing clearing-house roadmap).
4. Rewrite `docs/ROADMAP.md` to reflect the clearing-house vision and the integration trajectory with Orion / Constellation / other Synozur apps.
5. Move `server/routes.ts.backup` → `legacy/` (or delete; git has it).
6. Move stale planning files → `docs/archive/2026-Q2-consulting-era/`.
7. Update `docs/CHANGELOG.md` to mark v3.0 = "pivot to clearing house."

This is mostly mechanical writing and can be parallelized with the code work in P1.1-P1.4.

---

## P1 gaps within the current code, independent of the vision direction

These are real today and are worth picking up in parallel with the strategic work above.

1. **SSO token refresh scheduler is a stub.** `server/auth/sso-token-refresh.ts:152-163` — `startTokenRefreshScheduler()` only logs; it never refreshes any tokens. Active SSO sessions expire silently and users see auth failures with no clear cause. Either implement (iterate `sessions` table, call `acquireTokenByRefreshToken` per active row) or rip out the scheduler and the misleading log line.

2. **Azure client secret falls back to literal string `'placeholder'`.** `server/auth/entra-config.ts:58, 118, 162` — three call sites use `process.env.AZURE_CLIENT_SECRET || 'placeholder'`. MSAL is initialized with the string `'placeholder'` when the env var is missing, producing a confusing failure at first auth. Fail at startup or require the env var.

3. **Default-tenant fallback for unmatched signups.** `server/tenant-context.ts:112-116` — new users whose email domain doesn't match any tenant Azure mapping get auto-assigned to `DEFAULT_TENANT_SLUG`. In a multi-tenant SaaS taking signals from many source apps, this is a real data-isolation risk: a user filing via Orion could land in the wrong tenant. Reject the signup or surface a tenant-selection step.

4. **`global_admin` bypass on tenant-scoped support endpoints.** `server/routes/support-admin.ts:26` (`ensureTenantOrAdmin`) — global admins short-circuit the tenant check across queues, articles, settings. If intentional, document it in `CLAUDE.md`'s auth section so it isn't a surprise. If not, narrow the bypass to a specific allowlist.

5. **Inbound email webhook returns 401 with no operator help.** `server/routes/support-admin.ts:342` — `"Inbound email auth not configured"`. No admin UI to configure it, no log line points to docs. Add a setup page or at minimum log the config path on the error.

6. **Support attachment storage silently no-ops if GCS bucket is unset.** `server/services/support-attachment-storage.ts:68-79` — returns `null` if the bucket isn't configured, so uploads silently fail and users see "Submitted" with no attachment. Fail fast on the request or surface a config status on the support page.

7. **`as any` casts hide missing storage methods.** `server/services/support-auto-assign.ts:3` (`const s = storage as any`), `server/services/sla-breach-scheduler.ts:341` (`(storage as any).getLastSuccessfulScheduledJobRun?.`), `server/email-support.ts:215` (`(storage as any).getTenant?.()`). If any method is missing at runtime the call is silently a no-op — exactly the kind of bug you only find at 3am. Type the storage interface or add a hard runtime assertion at startup.

8. **`server/routes.ts.backup` (6,596 lines) is on the working tree.** Picked up by IDE search, dependency scans, and any "grep for vulnerable patterns" sweep. Move to `legacy/` or delete (git has it).

9. **Hardcoded fallback URL `'https://constellation.synozur.com'`.** `server/routes/support.ts:233, 748, 898` — three places use this when `APP_PUBLIC_URL` is unset. Once Palomar is multi-tenant clearing-house, hardcoding a specific app domain in a fallback path is wrong. Compute from `req.get('host')` (already used elsewhere) or fail loud if `APP_PUBLIC_URL` is missing.

---

## Recommendation

**Sprint 1 (this sprint):**
- Rewrite `CLAUDE.md` to reflect the clearing-house vision. (Half day.)
- Ship P1.1 (idempotent ingest by `externalReferenceId`) — small, high-value, unblocks reliable sibling-app integration.
- Knock out the 9 "independent" P1s above. Each is a few hours.

**Sprint 2:**
- Ship P1.2 (outbound webhooks). This is the big-ticket P1 — schema, delivery service, retry, signing, admin UI.
- Rewrite `backlog.md` + `docs/ROADMAP.md` once the new direction is on paper.

**Sprint 3:**
- Ship P1.3 (auto-correlation on ingest).
- Begin P1.4 (signal ingest beyond tickets) — this is exploratory and benefits from a design doc first.

**As background work:**
- Rewrite `docs/USER_GUIDE.md`, archive the stale planning files, delete `routes.ts.backup`.
