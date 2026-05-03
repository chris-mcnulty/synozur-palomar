-- Strip Constellation to consulting/delivery-management essentials.
-- Drops legacy delivery/billing/AI/teams/CRM tables, then creates the slim 22-table consulting schema.

DROP TABLE IF EXISTS "agent_card_health_checks" CASCADE;
DROP TABLE IF EXISTS "ai_configuration" CASCADE;
DROP TABLE IF EXISTS "ai_usage_alerts" CASCADE;
DROP TABLE IF EXISTS "ai_usage_logs" CASCADE;
DROP TABLE IF EXISTS "ai_usage_summaries" CASCADE;
DROP TABLE IF EXISTS "airport_codes" CASCADE;
DROP TABLE IF EXISTS "blocked_domains" CASCADE;
DROP TABLE IF EXISTS "change_orders" CASCADE;
DROP TABLE IF EXISTS "client_containers" CASCADE;
DROP TABLE IF EXISTS "client_rate_overrides" CASCADE;
DROP TABLE IF EXISTS "client_teams" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;
DROP TABLE IF EXISTS "consultant_access" CASCADE;
DROP TABLE IF EXISTS "container_columns" CASCADE;
DROP TABLE IF EXISTS "container_permissions" CASCADE;
DROP TABLE IF EXISTS "container_types" CASCADE;
DROP TABLE IF EXISTS "contractor_invoices" CASCADE;
DROP TABLE IF EXISTS "crm_connections" CASCADE;
DROP TABLE IF EXISTS "crm_object_mappings" CASCADE;
DROP TABLE IF EXISTS "crm_sync_log" CASCADE;
DROP TABLE IF EXISTS "deliverable_status_history" CASCADE;
DROP TABLE IF EXISTS "document_metadata" CASCADE;
DROP TABLE IF EXISTS "estimate_activities" CASCADE;
DROP TABLE IF EXISTS "estimate_allocations" CASCADE;
DROP TABLE IF EXISTS "estimate_channels" CASCADE;
DROP TABLE IF EXISTS "estimate_epics" CASCADE;
DROP TABLE IF EXISTS "estimate_line_items" CASCADE;
DROP TABLE IF EXISTS "estimate_milestones" CASCADE;
DROP TABLE IF EXISTS "estimate_rate_overrides" CASCADE;
DROP TABLE IF EXISTS "estimate_shares" CASCADE;
DROP TABLE IF EXISTS "estimate_stages" CASCADE;
DROP TABLE IF EXISTS "estimates" CASCADE;
DROP TABLE IF EXISTS "expense_attachments" CASCADE;
DROP TABLE IF EXISTS "expense_report_items" CASCADE;
DROP TABLE IF EXISTS "expense_reports" CASCADE;
DROP TABLE IF EXISTS "expenses" CASCADE;
DROP TABLE IF EXISTS "grounding_documents" CASCADE;
DROP TABLE IF EXISTS "guest_invitations" CASCADE;
DROP TABLE IF EXISTS "invoice_adjustments" CASCADE;
DROP TABLE IF EXISTS "invoice_batches" CASCADE;
DROP TABLE IF EXISTS "invoice_lines" CASCADE;
DROP TABLE IF EXISTS "mcp_write_audit" CASCADE;
DROP TABLE IF EXISTS "metadata_templates" CASCADE;
DROP TABLE IF EXISTS "oconus_per_diem_rates" CASCADE;
DROP TABLE IF EXISTS "organization_vocabulary" CASCADE;
DROP TABLE IF EXISTS "page_views" CASCADE;
DROP TABLE IF EXISTS "pending_receipts" CASCADE;
DROP TABLE IF EXISTS "planner_task_sync" CASCADE;
DROP TABLE IF EXISTS "project_activities" CASCADE;
DROP TABLE IF EXISTS "project_allocations" CASCADE;
DROP TABLE IF EXISTS "project_baselines" CASCADE;
DROP TABLE IF EXISTS "project_budget_history" CASCADE;
DROP TABLE IF EXISTS "project_channels" CASCADE;
DROP TABLE IF EXISTS "project_deliverables" CASCADE;
DROP TABLE IF EXISTS "project_engagements" CASCADE;
DROP TABLE IF EXISTS "project_epics" CASCADE;
DROP TABLE IF EXISTS "project_milestones" CASCADE;
DROP TABLE IF EXISTS "project_planner_connections" CASCADE;
DROP TABLE IF EXISTS "project_rate_overrides" CASCADE;
DROP TABLE IF EXISTS "project_stages" CASCADE;
DROP TABLE IF EXISTS "project_status_reports" CASCADE;
DROP TABLE IF EXISTS "project_workstreams" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "raidd_entries" CASCADE;
DROP TABLE IF EXISTS "rate_overrides" CASCADE;
DROP TABLE IF EXISTS "reimbursement_batches" CASCADE;
DROP TABLE IF EXISTS "reimbursement_line_items" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;
DROP TABLE IF EXISTS "scheduled_job_runs" CASCADE;
DROP TABLE IF EXISTS "service_plans" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "sows" CASCADE;
DROP TABLE IF EXISTS "status_reports" CASCADE;
DROP TABLE IF EXISTS "support_app_integration_keys" CASCADE;
DROP TABLE IF EXISTS "support_kb_articles" CASCADE;
DROP TABLE IF EXISTS "support_queues" CASCADE;
DROP TABLE IF EXISTS "support_sla_policies" CASCADE;
DROP TABLE IF EXISTS "support_ticket_activity" CASCADE;
DROP TABLE IF EXISTS "support_ticket_planner_sync" CASCADE;
DROP TABLE IF EXISTS "support_ticket_replies" CASCADE;
DROP TABLE IF EXISTS "support_ticket_watchers" CASCADE;
DROP TABLE IF EXISTS "support_tickets" CASCADE;
DROP TABLE IF EXISTS "system_settings" CASCADE;
DROP TABLE IF EXISTS "teams_alert_log" CASCADE;
DROP TABLE IF EXISTS "teams_automation_logs" CASCADE;
DROP TABLE IF EXISTS "teams_folder_templates" CASCADE;
DROP TABLE IF EXISTS "teams_member_sync_state" CASCADE;
DROP TABLE IF EXISTS "teams_tab_templates" CASCADE;
DROP TABLE IF EXISTS "tenant_microsoft_integrations" CASCADE;
DROP TABLE IF EXISTS "tenant_users" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;
DROP TABLE IF EXISTS "time_entries" CASCADE;
DROP TABLE IF EXISTS "user_azure_mappings" CASCADE;
DROP TABLE IF EXISTS "user_rate_schedules" CASCADE;
DROP TABLE IF EXISTS "user_role_capabilities" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "vocabulary_catalog" CASCADE;
--> statement-breakpoint

CREATE TABLE "agent_card_health_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar(20) NOT NULL,
	"checked_at" timestamp NOT NULL,
	"skill_count" integer,
	"errors" jsonb,
	"message" text,
	"trigger" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"reason" text,
	"blocked_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "grounding_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_tenant_background" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"session_id" text,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"triggered_by" text NOT NULL,
	"triggered_by_user_id" varchar,
	"result_summary" jsonb,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "service_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"plan_type" varchar(50) NOT NULL,
	"max_users" integer DEFAULT 5,
	"ai_enabled" boolean DEFAULT true,
	"sso_enabled" boolean DEFAULT false,
	"custom_branding_enabled" boolean DEFAULT false,
	"trial_duration_days" integer,
	"monthly_price_cents" integer,
	"annual_price_cents" integer,
	"billing_cycle" varchar(20),
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_plans_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"sso_provider" text,
	"sso_token" text,
	"sso_refresh_token" text,
	"sso_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_tenant_id" varchar
);
--> statement-breakpoint
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
CREATE TABLE "support_ticket_planner_sync" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"task_id" varchar(255) NOT NULL,
	"task_title" text,
	"bucket_id" varchar(255),
	"bucket_name" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"sync_error" text,
	"remote_etag" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false,
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
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" integer NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"assigned_to" varchar,
	"metadata" jsonb,
	"application_source" text DEFAULT 'Constellation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"ticket_type" text DEFAULT 'incident' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"impact" text,
	"urgency" text,
	"queue_id" varchar,
	"sla_policy_id" varchar,
	"first_response_due_at" timestamp,
	"first_response_at" timestamp,
	"resolution_due_at" timestamp,
	"sla_breached" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp,
	"external_requester_email" text,
	"external_requester_name" text,
	"portal_token" varchar(64),
	"app_integration_key_id" varchar,
	"csat_score" integer,
	"csat_comment" text,
	"csat_submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"setting_type" text DEFAULT 'string' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_microsoft_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(255),
	"azure_tenant_id" varchar(255) NOT NULL,
	"azure_tenant_name" text,
	"integration_type" text DEFAULT 'publisher_app' NOT NULL,
	"client_id" varchar(255),
	"client_secret_ref" text,
	"granted_scopes" text[],
	"consent_granted_at" timestamp,
	"consent_granted_by" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_validated_at" timestamp,
	"validation_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"role" varchar(50) DEFAULT 'employee' NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"invited_by" varchar,
	"invited_at" timestamp,
	"joined_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"color" text,
	"logo_url" text,
	"logo_url_dark" text,
	"favicon_url" text,
	"custom_subdomain" text,
	"branding" jsonb,
	"company_address" text,
	"company_phone" text,
	"company_email" text,
	"company_website" text,
	"allowed_domains" jsonb,
	"azure_tenant_id" text,
	"enforce_sso" boolean DEFAULT false,
	"allow_local_auth" boolean DEFAULT true,
	"invite_only" boolean DEFAULT false,
	"default_timezone" varchar(50) DEFAULT 'America/New_York',
	"service_plan_id" varchar,
	"plan_started_at" timestamp,
	"plan_expires_at" timestamp,
	"plan_status" text DEFAULT 'active',
	"self_service_signup" boolean DEFAULT false,
	"signup_completed_at" timestamp,
	"organization_size" text,
	"industry" text,
	"location" text,
	"email_header_url" text,
	"show_changelog_on_login" boolean DEFAULT true,
	"support_planner_enabled" boolean DEFAULT false,
	"support_planner_plan_id" varchar(255),
	"support_planner_plan_title" text,
	"support_planner_plan_web_url" text,
	"support_planner_group_id" varchar(255),
	"support_planner_group_name" text,
	"support_planner_bucket_name" text,
	"support_lists_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_name_unique" UNIQUE("name"),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_azure_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"azure_user_id" varchar(255) NOT NULL,
	"azure_upn" text,
	"azure_display_name" text,
	"mapping_method" text DEFAULT 'email' NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"initials" text,
	"title" text,
	"role" text DEFAULT 'employee' NOT NULL,
	"can_login" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"primary_tenant_id" varchar,
	"platform_role" varchar(50) DEFAULT 'user',
	"last_dismissed_changelog_version" varchar(50),
	"auth_provider" varchar(50),
	"azure_object_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_tenant_id_tenants_id_fk" FOREIGN KEY ("active_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_default_queue_id_support_queues_id_fk" FOREIGN KEY ("default_queue_id") REFERENCES "public"."support_queues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_app_integration_keys" ADD CONSTRAINT "support_app_integration_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_kb_articles" ADD CONSTRAINT "support_kb_articles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_kb_articles" ADD CONSTRAINT "support_kb_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_queues" ADD CONSTRAINT "support_queues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_queues" ADD CONSTRAINT "support_queues_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_sla_policies" ADD CONSTRAINT "support_sla_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_planner_sync" ADD CONSTRAINT "support_ticket_planner_sync_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_planner_sync" ADD CONSTRAINT "support_ticket_planner_sync_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD CONSTRAINT "support_ticket_replies_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD CONSTRAINT "support_ticket_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_watchers" ADD CONSTRAINT "support_ticket_watchers_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_watchers" ADD CONSTRAINT "support_ticket_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_queue_id_support_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."support_queues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_sla_policy_id_support_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."support_sla_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_app_integration_key_id_support_app_integration_keys_id_fk" FOREIGN KEY ("app_integration_key_id") REFERENCES "public"."support_app_integration_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_service_plan_id_service_plans_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."service_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_azure_mappings" ADD CONSTRAINT "user_azure_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_primary_tenant_id_tenants_id_fk" FOREIGN KEY ("primary_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_card_health_checks_checked_at" ON "agent_card_health_checks" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_grounding_docs_tenant" ON "grounding_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_grounding_docs_category" ON "grounding_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_grounding_docs_active" ON "grounding_documents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_tenant_id_idx" ON "scheduled_job_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_job_type_idx" ON "scheduled_job_runs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_started_at_idx" ON "scheduled_job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_support_app_keys_tenant" ON "support_app_integration_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_support_app_keys_prefix" ON "support_app_integration_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "idx_support_kb_tenant" ON "support_kb_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_support_kb_tenant_slug" ON "support_kb_articles" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "idx_support_queues_tenant" ON "support_queues" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_support_queue_tenant_name" ON "support_queues" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_support_sla_tenant" ON "support_sla_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_support_activity_ticket" ON "support_ticket_activity" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_watchers_ticket" ON "support_ticket_watchers" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_portal_token" ON "support_tickets" USING btree ("portal_token");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_queue" ON "support_tickets" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_tenant" ON "tenant_users" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_users_tenant" ON "tenant_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_users_user" ON "tenant_users" USING btree ("user_id");