import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Idempotent migration that creates the Wave 1 supporting tables:
 *   - `notifications` (per-user in-app notifications)
 *   - `audit_log` (immutable, append-only audit trail)
 *
 * Runs at server start so deployments that don't run `drizzle-kit push`
 * still get the schema applied. Safe to call repeatedly.
 *
 * Drizzle-kit push is still the source of truth in development — this is a
 * production-safety net that mirrors the existing `support-fts-migration`
 * pattern.
 */
export async function ensureWave1Objects(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
        type VARCHAR(64) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link_url TEXT,
        resource_type VARCHAR(64),
        resource_id VARCHAR,
        metadata JSONB,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_resource ON notifications (resource_type, resource_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE SET NULL,
        actor_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        actor_label TEXT,
        actor_ip VARCHAR(64),
        action VARCHAR(128) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id VARCHAR,
        field_name VARCHAR(128),
        old_value TEXT,
        new_value TEXT,
        metadata JSONB,
        correlation_id VARCHAR(64),
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log (resource_type, resource_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scheduled_job_runs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR REFERENCES tenants(id),
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT now(),
        completed_at TIMESTAMP,
        triggered_by TEXT NOT NULL,
        triggered_by_user_id VARCHAR REFERENCES users(id),
        result_summary JSONB,
        error_message TEXT
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scheduled_job_runs_tenant_id_idx ON scheduled_job_runs (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scheduled_job_runs_job_type_idx ON scheduled_job_runs (job_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scheduled_job_runs_started_at_idx ON scheduled_job_runs (started_at)`);
  } catch (err: any) {
    console.warn("[wave1-migration] warning:", err?.message || err);
  }
}

/**
 * Wave 3 tables: ticket links (duplicate / related-to relationships) and
 * tenant routing rules. Same idempotent CREATE IF NOT EXISTS pattern.
 */
export async function ensureWave3Objects(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_ticket_links (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        linked_ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        link_type VARCHAR(32) NOT NULL,
        created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_ticket_links_ticket ON support_ticket_links (ticket_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_ticket_links_linked ON support_ticket_links (linked_ticket_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_support_ticket_link ON support_ticket_links (ticket_id, linked_ticket_id, link_type)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_routing_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        conditions JSONB NOT NULL,
        action VARCHAR(32) NOT NULL,
        target_queue_id VARCHAR REFERENCES support_queues(id) ON DELETE SET NULL,
        target_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        target_priority VARCHAR(16),
        stop_on_match BOOLEAN NOT NULL DEFAULT TRUE,
        created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_routing_rules_tenant ON support_routing_rules (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_routing_rules_active_order ON support_routing_rules (tenant_id, is_active, sort_order)`);
  } catch (err: any) {
    console.warn("[wave3-migration] warning:", err?.message || err);
  }
}
