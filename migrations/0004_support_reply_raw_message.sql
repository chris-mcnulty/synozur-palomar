-- Task #10: Trim quoted reply history from inbound email replies
-- Adds a column to retain the full unmodified email body for audit when the
-- timeline-visible `message` column has been trimmed of quoted history /
-- signature blocks. Already applied in dev via drizzle-kit push; this file
-- scopes the DDL so it can be replayed on production.

ALTER TABLE "support_ticket_replies"
  ADD COLUMN IF NOT EXISTS "raw_message" text;
