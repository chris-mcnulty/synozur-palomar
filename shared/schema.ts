import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, index, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// SHARED TYPES / ENUMS
// ============================================================================

export const planStatusEnum = z.enum(['active', 'trial', 'expired', 'cancelled', 'suspended']);
export type PlanStatus = z.infer<typeof planStatusEnum>;

export type TenantBranding = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  tagline?: string;
  reportHeaderText?: string;
  reportFooterText?: string;
};

// Support ticket enums
export const TICKET_CATEGORIES = ['bug', 'feature_request', 'question', 'feedback'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const TICKET_STATUSES = ['new', 'open', 'in_progress', 'pending', 'on_hold', 'resolved', 'closed', 'cancelled'] as const;
export const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change', 'question'] as const;
export const TICKET_SOURCES = ['web', 'portal', 'email', 'api', 'phone', 'chat'] as const;
export const TICKET_IMPACTS = ['low', 'medium', 'high'] as const;
export const TICKET_URGENCIES = ['low', 'medium', 'high'] as const;

export type TicketCategory = typeof TICKET_CATEGORIES[number];
export type TicketPriority = typeof TICKET_PRIORITIES[number];
export type TicketStatus = typeof TICKET_STATUSES[number];
export type TicketType = typeof TICKET_TYPES[number];
export type TicketSource = typeof TICKET_SOURCES[number];

// ============================================================================
// MULTI-TENANCY: SERVICE PLANS, TENANTS, BLOCKED DOMAINS
// ============================================================================

export const servicePlans = pgTable("service_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internalName: varchar("internal_name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  maxUsers: integer("max_users").default(5),
  aiEnabled: boolean("ai_enabled").default(true),
  ssoEnabled: boolean("sso_enabled").default(false),
  customBrandingEnabled: boolean("custom_branding_enabled").default(false),
  trialDurationDays: integer("trial_duration_days"),
  monthlyPriceCents: integer("monthly_price_cents"),
  annualPriceCents: integer("annual_price_cents"),
  billingCycle: varchar("billing_cycle", { length: 20 }),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertServicePlanSchema = createInsertSchema(servicePlans).omit({ id: true, createdAt: true });
export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;
export type ServicePlan = typeof servicePlans.$inferSelect;

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),

  // Branding
  color: text("color"),
  logoUrl: text("logo_url"),
  logoUrlDark: text("logo_url_dark"),
  faviconUrl: text("favicon_url"),
  customSubdomain: text("custom_subdomain"),
  branding: jsonb("branding").$type<TenantBranding>(),

  // Company contact info
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),

  // Domain & SSO
  allowedDomains: jsonb("allowed_domains").$type<string[]>(),
  azureTenantId: text("azure_tenant_id"),
  enforceSso: boolean("enforce_sso").default(false),
  allowLocalAuth: boolean("allow_local_auth").default(true),
  inviteOnly: boolean("invite_only").default(false),
  
  // M365 Connectors
  connectorSharePoint: boolean("connector_sharepoint").default(false),
  connectorOutlook: boolean("connector_outlook").default(false),
  connectorPlanner: boolean("connector_planner").default(false),
  // Support email channel — per-tenant sender identity for outbound replies and
  // the domain used in the per-ticket Reply-To address that loops back through
  // the inbound webhook (e.g. ticket+<token>@support.<tenant>.com).
  supportFromEmail: text("support_from_email"),
  supportFromName: text("support_from_name"),
  supportReplyDomain: text("support_reply_domain"),
  adminConsentGranted: boolean("admin_consent_granted").default(false),
  adminConsentGrantedAt: timestamp("admin_consent_granted_at"),
  adminConsentGrantedBy: varchar("admin_consent_granted_by"),
  
  // Customization
  defaultTimezone: varchar("default_timezone", { length: 50 }).default("America/New_York"),

  // Service plan
  servicePlanId: varchar("service_plan_id").references(() => servicePlans.id),
  planStartedAt: timestamp("plan_started_at"),
  planExpiresAt: timestamp("plan_expires_at"),
  planStatus: text("plan_status").default("active"),

  // Signup
  selfServiceSignup: boolean("self_service_signup").default(false),
  signupCompletedAt: timestamp("signup_completed_at"),
  organizationSize: text("organization_size"),
  industry: text("industry"),
  location: text("location"),

  // Email branding
  emailHeaderUrl: text("email_header_url"),

  // Feature settings
  showChangelogOnLogin: boolean("show_changelog_on_login").default(true),

  // Support integrations (Planner)
  supportPlannerEnabled: boolean("support_planner_enabled").default(false),
  supportPlannerPlanId: varchar("support_planner_plan_id", { length: 255 }),
  supportPlannerPlanTitle: text("support_planner_plan_title"),
  supportPlannerPlanWebUrl: text("support_planner_plan_web_url"),
  supportPlannerGroupId: varchar("support_planner_group_id", { length: 255 }),
  supportPlannerGroupName: text("support_planner_group_name"),
  supportPlannerBucketName: text("support_planner_bucket_name"),
  supportListsEnabled: boolean("support_lists_enabled").default(false),

  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export const blockedDomains = pgTable("blocked_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  reason: text("reason"),
  blockedBy: varchar("blocked_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertBlockedDomainSchema = createInsertSchema(blockedDomains).omit({ id: true, createdAt: true });
export type InsertBlockedDomain = z.infer<typeof insertBlockedDomainSchema>;
export type BlockedDomain = typeof blockedDomains.$inferSelect;

// ============================================================================
// USERS, TENANT MEMBERSHIP
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  initials: text("initials"),
  title: text("title"),
  role: text("role").notNull().default("employee"),
  canLogin: boolean("can_login").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  passwordHash: text("password_hash"),
  primaryTenantId: varchar("primary_tenant_id").references(() => tenants.id),
  platformRole: varchar("platform_role", { length: 50 }).default("user"),
  lastDismissedChangelogVersion: varchar("last_dismissed_changelog_version", { length: 50 }),
  authProvider: varchar("auth_provider", { length: 50 }),
  azureObjectId: varchar("azure_object_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const tenantUsers = pgTable("tenant_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 50 }).notNull().default("employee"),
  status: varchar("status", { length: 50 }).default("active"),
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  uniqueUserTenant: uniqueIndex("unique_user_tenant").on(table.userId, table.tenantId),
  tenantIdx: index("idx_tenant_users_tenant").on(table.tenantId),
  userIdx: index("idx_tenant_users_user").on(table.userId),
}));

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({ id: true, createdAt: true });
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

// ============================================================================
// SESSIONS
// ============================================================================

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  ssoProvider: text("sso_provider"),
  ssoToken: text("sso_token"),
  ssoRefreshToken: text("sso_refresh_token"),
  ssoTokenExpiry: timestamp("sso_token_expiry"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  lastActivity: timestamp("last_activity").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  activeTenantId: varchar("active_tenant_id").references(() => tenants.id),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
  expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
}));
export const insertSessionSchema = createInsertSchema(sessions).omit({ createdAt: true, lastActivity: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// ============================================================================
// SCHEDULED JOB RUNS, SYSTEM SETTINGS
// ============================================================================

export const scheduledJobRuns = pgTable("scheduled_job_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  jobType: text("job_type").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
  triggeredBy: text("triggered_by").notNull(),
  triggeredByUserId: varchar("triggered_by_user_id").references(() => users.id),
  resultSummary: jsonb("result_summary"),
  errorMessage: text("error_message"),
}, (table) => ({
  tenantIdIdx: index("scheduled_job_runs_tenant_id_idx").on(table.tenantId),
  jobTypeIdx: index("scheduled_job_runs_job_type_idx").on(table.jobType),
  startedAtIdx: index("scheduled_job_runs_started_at_idx").on(table.startedAt),
}));
export const insertScheduledJobRunSchema = createInsertSchema(scheduledJobRuns).omit({ id: true, startedAt: true });
export type InsertScheduledJobRun = z.infer<typeof insertScheduledJobRunSchema>;
export type ScheduledJobRun = typeof scheduledJobRuns.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  settingType: text("setting_type").notNull().default("string"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

// ============================================================================
// MICROSOFT 365 INTEGRATION (slim — kept for SSO + future Planner use)
// ============================================================================

export const tenantMicrosoftIntegrations = pgTable("tenant_microsoft_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 255 }),
  azureTenantId: varchar("azure_tenant_id", { length: 255 }).notNull(),
  azureTenantName: text("azure_tenant_name"),
  integrationType: text("integration_type").notNull().default('publisher_app'),
  clientId: varchar("client_id", { length: 255 }),
  clientSecretRef: text("client_secret_ref"),
  grantedScopes: text("granted_scopes").array(),
  consentGrantedAt: timestamp("consent_granted_at"),
  consentGrantedBy: varchar("consent_granted_by", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  lastValidatedAt: timestamp("last_validated_at"),
  validationError: text("validation_error"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertTenantMicrosoftIntegrationSchema = createInsertSchema(tenantMicrosoftIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenantMicrosoftIntegration = z.infer<typeof insertTenantMicrosoftIntegrationSchema>;
export type TenantMicrosoftIntegration = typeof tenantMicrosoftIntegrations.$inferSelect;

export const userAzureMappings = pgTable("user_azure_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  azureUserId: varchar("azure_user_id", { length: 255 }).notNull(),
  azureUserPrincipalName: text("azure_upn"),
  azureDisplayName: text("azure_display_name"),
  mappingMethod: text("mapping_method").notNull().default('email'),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertUserAzureMappingSchema = createInsertSchema(userAzureMappings).omit({ id: true, createdAt: true });
export type InsertUserAzureMapping = z.infer<typeof insertUserAzureMappingSchema>;
export type UserAzureMapping = typeof userAzureMappings.$inferSelect;

// ============================================================================
// GROUNDING DOCUMENTS (used by support routes for AI assist; kept lean)
// ============================================================================

export const groundingDocuments = pgTable("grounding_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull().default('general'),
  content: text("content").notNull(),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isTenantBackground: boolean("is_tenant_background").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_grounding_docs_tenant").on(table.tenantId),
  categoryIdx: index("idx_grounding_docs_category").on(table.category),
  activeIdx: index("idx_grounding_docs_active").on(table.isActive),
}));
export const insertGroundingDocumentSchema = createInsertSchema(groundingDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroundingDocument = z.infer<typeof insertGroundingDocumentSchema>;
export type GroundingDocument = typeof groundingDocuments.$inferSelect;

// ============================================================================
// SUPPORT TICKETING
// ============================================================================

export const supportQueues = pgTable("support_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  emailAlias: text("email_alias"),
  plannerBucketName: text("planner_bucket_name"),
  defaultAssigneeId: varchar("default_assignee_id").references(() => users.id, { onDelete: 'set null' }),
  escalationContactEmail: text("escalation_contact_email"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_queues_tenant").on(table.tenantId),
  uniqueTenantName: uniqueIndex("unique_support_queue_tenant_name").on(table.tenantId, table.name),
}));
export const insertSupportQueueSchema = createInsertSchema(supportQueues).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportQueue = z.infer<typeof insertSupportQueueSchema>;
export type SupportQueue = typeof supportQueues.$inferSelect;

export const supportSlaPolicies = pgTable("support_sla_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  priority: text("priority").notNull(),
  ticketType: text("ticket_type"),
  firstResponseMinutes: integer("first_response_minutes").notNull().default(60),
  resolutionMinutes: integer("resolution_minutes").notNull().default(1440),
  businessHoursOnly: boolean("business_hours_only").notNull().default(false),
  bumpPriorityOnBreach: boolean("bump_priority_on_breach").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_sla_tenant").on(table.tenantId),
}));
export const insertSupportSlaPolicySchema = createInsertSchema(supportSlaPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportSlaPolicy = z.infer<typeof insertSupportSlaPolicySchema>;
export type SupportSlaPolicy = typeof supportSlaPolicies.$inferSelect;

export const supportKbArticles = pgTable("support_kb_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  body: text("body").notNull(),
  summary: text("summary"),
  visibility: text("visibility").notNull().default("internal"),
  tags: text("tags").array(),
  authorId: varchar("author_id").references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").notNull().default(0),
  helpfulCount: integer("helpful_count").notNull().default(0),
  notHelpfulCount: integer("not_helpful_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_kb_tenant").on(table.tenantId),
  uniqueTenantSlug: uniqueIndex("unique_support_kb_tenant_slug").on(table.tenantId, table.slug),
}));
export const insertSupportKbArticleSchema = createInsertSchema(supportKbArticles, {
  tags: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, helpfulCount: true, notHelpfulCount: true });
export type InsertSupportKbArticle = z.infer<typeof insertSupportKbArticleSchema>;
export type SupportKbArticle = typeof supportKbArticles.$inferSelect;

// Lightweight portal/support analytics events (article views, deflection, etc.)
export const supportEvents = pgTable("support_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  articleId: varchar("article_id"),
  sessionId: varchar("session_id", { length: 128 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_events_tenant").on(table.tenantId),
  typeIdx: index("idx_support_events_type").on(table.eventType),
}));
export type SupportEvent = typeof supportEvents.$inferSelect;

// App Integration Keys (for SYNOZUR apps to file tickets via API)
export const supportAppIntegrationKeys = pgTable("support_app_integration_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  applicationName: text("application_name").notNull(),
  description: text("description"),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  keyHash: text("key_hash").notNull(),
  defaultQueueId: varchar("default_queue_id").references(() => supportQueues.id, { onDelete: 'set null' }),
  defaultTicketType: text("default_ticket_type").default("incident"),
  scopes: text("scopes").array(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_app_keys_tenant").on(table.tenantId),
  prefixIdx: index("idx_support_app_keys_prefix").on(table.keyPrefix),
}));
export const insertSupportAppIntegrationKeySchema = createInsertSchema(supportAppIntegrationKeys, {
  scopes: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, lastUsedAt: true, revokedAt: true });
export type InsertSupportAppIntegrationKey = z.infer<typeof insertSupportAppIntegrationKeySchema>;
export type SupportAppIntegrationKey = typeof supportAppIntegrationKeys.$inferSelect;

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: integer("ticket_number").notNull(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("new"),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb("metadata"),
  applicationSource: text("application_source").notNull().default("Constellation"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: 'set null' }),
  ticketType: text("ticket_type").notNull().default("incident"),
  source: text("source").notNull().default("web"),
  impact: text("impact"),
  urgency: text("urgency"),
  queueId: varchar("queue_id").references(() => supportQueues.id, { onDelete: 'set null' }),
  slaPolicyId: varchar("sla_policy_id").references(() => supportSlaPolicies.id, { onDelete: 'set null' }),
  firstResponseDueAt: timestamp("first_response_due_at"),
  firstResponseAt: timestamp("first_response_at"),
  resolutionDueAt: timestamp("resolution_due_at"),
  slaBreached: boolean("sla_breached").notNull().default(false),
  closedAt: timestamp("closed_at"),
  externalRequesterEmail: text("external_requester_email"),
  externalRequesterName: text("external_requester_name"),
  portalToken: varchar("portal_token", { length: 64 }),
  appIntegrationKeyId: varchar("app_integration_key_id").references(() => supportAppIntegrationKeys.id, { onDelete: 'set null' }),
  csatScore: integer("csat_score"),
  csatComment: text("csat_comment"),
  csatSubmittedAt: timestamp("csat_submitted_at"),
}, (table) => ({
  portalTokenIdx: index("idx_support_tickets_portal_token").on(table.portalToken),
  queueIdx: index("idx_support_tickets_queue").on(table.queueId),
  statusIdx: index("idx_support_tickets_status").on(table.status),
}));
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true, ticketNumber: true, createdAt: true, updatedAt: true, resolvedAt: true, resolvedBy: true,
});
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export const supportTicketReplies = pgTable("support_ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false),
  // RFC 5322 message identifiers for reliable email threading.
  // messageId is the Message-ID header of the email we sent or received for this reply.
  // inReplyTo is the In-Reply-To header value of the inbound message (so we can chain).
  messageId: text("message_id"),
  inReplyTo: text("in_reply_to"),
  // Tracks how the reply entered the system: "web" (agent console), "portal", "email", "api".
  source: text("source"),
  // Free-form sender label for inbound emails when userId is null (e.g. external requester address).
  externalAuthor: text("external_author"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  messageIdIdx: index("idx_support_ticket_replies_message_id").on(table.messageId),
  ticketIdx: index("idx_support_ticket_replies_ticket").on(table.ticketId),
}));

export const insertSupportTicketReplySchema = createInsertSchema(supportTicketReplies).omit({
  id: true,
  createdAt: true,
});

export type InsertSupportTicketReply = z.infer<typeof insertSupportTicketReplySchema>;
export type SupportTicketReply = typeof supportTicketReplies.$inferSelect;

// Inbound email attachments captured for a ticket. Stored either inline in object
// storage (storageKey set) or — for the dev/local environment — on disk.
export const supportTicketAttachments = pgTable("support_ticket_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  replyId: varchar("reply_id").references(() => supportTicketReplies.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  storageKey: text("storage_key").notNull(),
  storageBackend: text("storage_backend").notNull().default("local"), // 'local' | 'object_storage'
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  ticketIdx: index("idx_support_attachments_ticket").on(table.ticketId),
  replyIdx: index("idx_support_attachments_reply").on(table.replyId),
}));

export const insertSupportTicketAttachmentSchema = createInsertSchema(supportTicketAttachments).omit({ id: true, createdAt: true });
export type InsertSupportTicketAttachment = z.infer<typeof insertSupportTicketAttachmentSchema>;
export type SupportTicketAttachment = typeof supportTicketAttachments.$inferSelect;

// Microsoft Graph mailbox change-notification subscriptions used to drive the
// inbound support email pipeline. Persisted so the renewer + notification
// handler survive process restarts.
export const supportEmailSubscriptions = pgTable("support_email_subscriptions", {
  id: varchar("id").primaryKey(), // Graph subscription id
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  azureTenantId: text("azure_tenant_id").notNull(),
  mailbox: text("mailbox").notNull(),
  clientState: text("client_state").notNull(),
  notificationUrl: text("notification_url").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  tenantIdx: index("idx_support_email_subs_tenant").on(table.tenantId),
}));

export const insertSupportEmailSubscriptionSchema = createInsertSchema(supportEmailSubscriptions).omit({ createdAt: true, updatedAt: true });
export type InsertSupportEmailSubscription = z.infer<typeof insertSupportEmailSubscriptionSchema>;
export type SupportEmailSubscription = typeof supportEmailSubscriptions.$inferSelect;

// Support Ticket to Planner Task sync tracking
export const supportTicketPlannerSync = pgTable("support_ticket_planner_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id", { length: 255 }).notNull(),
  taskId: varchar("task_id", { length: 255 }).notNull(),
  taskTitle: text("task_title"),
  bucketId: varchar("bucket_id", { length: 255 }),
  bucketName: text("bucket_name"),
  lastSyncedAt: timestamp("last_synced_at").notNull().default(sql`now()`),
  syncStatus: text("sync_status").notNull().default('synced'),
  syncError: text("sync_error"),
  remoteEtag: text("remote_etag"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertSupportTicketPlannerSyncSchema = createInsertSchema(supportTicketPlannerSync).omit({ id: true, createdAt: true });
export type InsertSupportTicketPlannerSync = z.infer<typeof insertSupportTicketPlannerSyncSchema>;
export type SupportTicketPlannerSync = typeof supportTicketPlannerSync.$inferSelect;

export const supportTicketWatchers = pgTable("support_ticket_watchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  externalEmail: text("external_email"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  ticketIdx: index("idx_support_watchers_ticket").on(table.ticketId),
}));
export const insertSupportTicketWatcherSchema = createInsertSchema(supportTicketWatchers).omit({ id: true, createdAt: true });
export type InsertSupportTicketWatcher = z.infer<typeof insertSupportTicketWatcherSchema>;
export type SupportTicketWatcher = typeof supportTicketWatchers.$inferSelect;

export const supportTicketActivity = pgTable("support_ticket_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: 'set null' }),
  actorLabel: text("actor_label"),
  action: text("action").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  ticketIdx: index("idx_support_activity_ticket").on(table.ticketId),
}));
export const insertSupportTicketActivitySchema = createInsertSchema(supportTicketActivity).omit({ id: true, createdAt: true });
export type InsertSupportTicketActivity = z.infer<typeof insertSupportTicketActivitySchema>;
export type SupportTicketActivity = typeof supportTicketActivity.$inferSelect;

// ============================================================================
// AGENT CARD HEALTH CHECKS, PAGE VIEWS
// ============================================================================

export const agentCardHealthChecks = pgTable("agent_card_health_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: varchar("status", { length: 20 }).notNull(),
  checkedAt: timestamp("checked_at").notNull(),
  skillCount: integer("skill_count"),
  errors: jsonb("errors").$type<string[]>(),
  message: text("message"),
  trigger: varchar("trigger", { length: 50 }).notNull().default("scheduled"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  checkedAtIdx: index("idx_agent_card_health_checks_checked_at").on(table.checkedAt),
}));
export const insertAgentCardHealthCheckSchema = createInsertSchema(agentCardHealthChecks).omit({ id: true, createdAt: true });
export type InsertAgentCardHealthCheck = z.infer<typeof insertAgentCardHealthCheckSchema>;
export type AgentCardHealthCheck = typeof agentCardHealthChecks.$inferSelect;

export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull(),
  sessionId: text("session_id"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertPageViewSchema = createInsertSchema(pageViews).omit({ id: true, createdAt: true });
export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type PageView = typeof pageViews.$inferSelect;

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  primaryTenant: one(tenants, { fields: [users.primaryTenantId], references: [tenants.id] }),
  memberships: many(tenantUsers),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  servicePlan: one(servicePlans, { fields: [tenants.servicePlanId], references: [servicePlans.id] }),
  members: many(tenantUsers),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  user: one(users, { fields: [tenantUsers.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
}));

export const groundingDocumentsRelations = relations(groundingDocuments, ({ one }) => ({
  tenant: one(tenants, { fields: [groundingDocuments.tenantId], references: [tenants.id] }),
  createdByUser: one(users, { fields: [groundingDocuments.createdBy], references: [users.id] }),
  updatedByUser: one(users, { fields: [groundingDocuments.updatedBy], references: [users.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [supportTickets.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  assignee: one(users, { fields: [supportTickets.assignedTo], references: [users.id] }),
  queue: one(supportQueues, { fields: [supportTickets.queueId], references: [supportQueues.id] }),
  slaPolicy: one(supportSlaPolicies, { fields: [supportTickets.slaPolicyId], references: [supportSlaPolicies.id] }),
  replies: many(supportTicketReplies),
  watchers: many(supportTicketWatchers),
  activity: many(supportTicketActivity),
}));

export const supportTicketRepliesRelations = relations(supportTicketReplies, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportTicketReplies.ticketId], references: [supportTickets.id] }),
  user: one(users, { fields: [supportTicketReplies.userId], references: [users.id] }),
}));
