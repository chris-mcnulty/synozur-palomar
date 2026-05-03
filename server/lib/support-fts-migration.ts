import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Idempotent migration that adds Postgres FTS (tsvector) generated columns and
 * GIN indexes to supportTickets and supportTicketReplies. Runs at server start.
 *
 * tsvector + GENERATED ALWAYS AS columns are awkward to express via Drizzle's
 * schema, so we manage them with raw SQL here. Safe to call repeatedly.
 */
export async function ensureSupportFtsObjects(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE support_tickets
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
          setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'B')
        ) STORED
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_tickets_search ON support_tickets USING GIN (search_vector)`);

    await db.execute(sql`
      ALTER TABLE support_ticket_replies
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(message, ''))) STORED
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_replies_search ON support_ticket_replies USING GIN (search_vector)`);
  } catch (err: any) {
    console.warn("[support-fts] migration warning:", err?.message || err);
  }
}
