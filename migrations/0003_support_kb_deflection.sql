-- Task #5: Public KB + ticket deflection
-- Adds an analytics events table for the support portal and a counter for
-- "not helpful" article feedback. These columns/tables are already applied
-- to the dev database via drizzle-kit push; this file scopes the DDL so it
-- can be replayed on production.

ALTER TABLE "support_kb_articles"
  ADD COLUMN IF NOT EXISTS "not_helpful_count" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "support_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "event_type" varchar(64) NOT NULL,
  "article_id" varchar,
  "session_id" varchar(128),
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_support_events_tenant" ON "support_events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_support_events_type" ON "support_events" ("event_type");
