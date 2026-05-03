ALTER TABLE "support_queues" ADD COLUMN IF NOT EXISTS "escalation_contact_email" text;
--> statement-breakpoint
ALTER TABLE "support_sla_policies" ADD COLUMN IF NOT EXISTS "bump_priority_on_breach" boolean DEFAULT false NOT NULL;
