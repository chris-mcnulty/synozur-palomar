-- Wave 3: ticket links (duplicate / related-to / blocks relationships) +
-- tenant routing rules engine. Mirrored by the idempotent boot-time helper
-- in server/lib/wave1-migration.ts (ensureWave3Objects).

CREATE TABLE IF NOT EXISTS support_ticket_links (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  linked_ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  link_type VARCHAR(32) NOT NULL,
  created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_links_ticket ON support_ticket_links (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_links_linked ON support_ticket_links (linked_ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_support_ticket_link ON support_ticket_links (ticket_id, linked_ticket_id, link_type);

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
);

CREATE INDEX IF NOT EXISTS idx_support_routing_rules_tenant ON support_routing_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_routing_rules_active_order ON support_routing_rules (tenant_id, is_active, sort_order);
