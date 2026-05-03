CREATE TABLE "support_app_integration_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"application_name" text NOT NULL,
	"description" text,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" text NOT NULL,
	"default_queue_id" varchar,
	"default_ticket_type" text DEFAULT 'incident',
	"scopes" text[],
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_email_subscriptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"azure_tenant_id" text NOT NULL,
	"mailbox" text NOT NULL,
	"client_state" text NOT NULL,
	"notification_url" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_kb_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"tags" text[],
	"author_id" varchar,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_queues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"email_alias" text,
	"planner_bucket_name" text,
	"default_assignee_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_sla_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"priority" text NOT NULL,
	"ticket_type" text,
	"first_response_minutes" integer DEFAULT 60 NOT NULL,
	"resolution_minutes" integer DEFAULT 1440 NOT NULL,
	"business_hours_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"actor_label" text,
	"action" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"reply_id" varchar,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"storage_backend" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_watchers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar,
	"external_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_ticket_replies" DROP CONSTRAINT "support_ticket_replies_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD COLUMN "in_reply_to" text;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD COLUMN "external_author" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "ticket_type" text DEFAULT 'incident' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "source" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "impact" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "urgency" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "queue_id" varchar;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "sla_policy_id" varchar;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "first_response_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "first_response_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "resolution_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "sla_breached" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "external_requester_email" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "external_requester_name" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "portal_token" varchar(64);--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "app_integration_key_id" varchar;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "csat_score" integer;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "csat_comment" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "csat_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "support_from_email" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "support_from_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "support_reply_domain" text;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_default_queue_id_support_queues_id_fk" FOREIGN KEY ("default_queue_id") REFERENCES "public"."support_queues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_email_subscriptions" ADD CONSTRAINT "support_email_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_kb_articles" ADD CONSTRAINT "support_kb_articles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_kb_articles" ADD CONSTRAINT "support_kb_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_queues" ADD CONSTRAINT "support_queues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_queues" ADD CONSTRAINT "support_queues_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_sla_policies" ADD CONSTRAINT "support_sla_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_reply_id_support_ticket_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."support_ticket_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_watchers" ADD CONSTRAINT "support_ticket_watchers_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_watchers" ADD CONSTRAINT "support_ticket_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_support_app_keys_tenant" ON "support_app_integration_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_support_app_keys_prefix" ON "support_app_integration_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "idx_support_email_subs_tenant" ON "support_email_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_support_kb_tenant" ON "support_kb_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_support_kb_tenant_slug" ON "support_kb_articles" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "idx_support_queues_tenant" ON "support_queues" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_support_queue_tenant_name" ON "support_queues" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_support_sla_tenant" ON "support_sla_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_support_activity_ticket" ON "support_ticket_activity" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_attachments_ticket" ON "support_ticket_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_attachments_reply" ON "support_ticket_attachments" USING btree ("reply_id");--> statement-breakpoint
CREATE INDEX "idx_support_watchers_ticket" ON "support_ticket_watchers" USING btree ("ticket_id");--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD CONSTRAINT "support_ticket_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_queue_id_support_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."support_queues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_sla_policy_id_support_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."support_sla_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_app_integration_key_id_support_app_integration_keys_id_fk" FOREIGN KEY ("app_integration_key_id") REFERENCES "public"."support_app_integration_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_support_ticket_replies_message_id" ON "support_ticket_replies" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_support_ticket_replies_ticket" ON "support_ticket_replies" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_portal_token" ON "support_tickets" USING btree ("portal_token");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_queue" ON "support_tickets" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");