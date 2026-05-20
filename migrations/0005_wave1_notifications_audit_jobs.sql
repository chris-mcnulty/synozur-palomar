-- Wave 1 hardening: in-app notifications, immutable audit log, scheduled job runs
-- This migration is also applied at boot via server/lib/wave1-migration.ts
-- (CREATE … IF NOT EXISTS), so it's safe to push or apply by hand.

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
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_resource ON notifications (resource_type, resource_id);

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
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);

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
);

CREATE INDEX IF NOT EXISTS scheduled_job_runs_tenant_id_idx ON scheduled_job_runs (tenant_id);
CREATE INDEX IF NOT EXISTS scheduled_job_runs_job_type_idx ON scheduled_job_runs (job_type);
CREATE INDEX IF NOT EXISTS scheduled_job_runs_started_at_idx ON scheduled_job_runs (started_at);
