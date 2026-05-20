import {
  users, tenants, blockedDomains, systemSettings,
  groundingDocuments,
  supportQueues, supportQueueMembers, supportQueueRoundRobinState,
  supportSlaPolicies, supportKbArticles, supportAppIntegrationKeys,
  supportTickets, supportTicketReplies, supportTicketPlannerSync,
  supportTicketWatchers, supportTicketActivity,
  supportSavedFilters,
  agentCardHealthChecks,
  scheduledJobRuns,
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type BlockedDomain, type InsertBlockedDomain,
  type SystemSetting, type InsertSystemSetting,
  type GroundingDocument, type InsertGroundingDocument,
  type SupportQueue, type InsertSupportQueue,
  type SupportQueueMember,
  type SupportSlaPolicy, type InsertSupportSlaPolicy,
  type SupportKbArticle, type InsertSupportKbArticle,
  type SupportAppIntegrationKey, type InsertSupportAppIntegrationKey,
  type SupportTicket, type InsertSupportTicket,
  type SupportTicketReply, type InsertSupportTicketReply,
  type SupportTicketPlannerSync, type InsertSupportTicketPlannerSync,
  type SupportTicketWatcher, type InsertSupportTicketWatcher,
  type SupportTicketActivity, type InsertSupportTicketActivity,
  type SupportSavedFilter, type InsertSupportSavedFilter,
  type AgentCardHealthCheck, type InsertAgentCardHealthCheck,
  type ScheduledJobRun, type InsertScheduledJobRun,
} from "@shared/schema";
import { db } from "./db";
import { eq, ne, and, or, desc, asc, sql, ilike, isNotNull, isNull, inArray, gte, lte, type SQL } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  getPlatformAdminEmails(): Promise<string[]>;

  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant>;

  // Blocked Domains
  getBlockedDomains(): Promise<BlockedDomain[]>;
  isDomainBlocked(domain: string): Promise<boolean>;

  // System Settings
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
  getSystemSettingValue(key: string, defaultValue?: string): Promise<string>;
  setSystemSetting(key: string, value: string, description?: string, settingType?: string): Promise<SystemSetting>;
  deleteSystemSetting(id: string): Promise<void>;

  // Grounding Documents
  getGroundingDocuments(tenantId?: string | null, opts?: { isActive?: boolean }): Promise<GroundingDocument[]>;
  getGroundingDocument(id: string): Promise<GroundingDocument | undefined>;
  createGroundingDocument(doc: InsertGroundingDocument): Promise<GroundingDocument>;
  updateGroundingDocument(id: string, updates: Partial<InsertGroundingDocument>): Promise<GroundingDocument>;
  deleteGroundingDocument(id: string): Promise<void>;

  // Support Queues
  getSupportQueues(tenantId: string): Promise<SupportQueue[]>;
  getSupportQueueById(id: string): Promise<SupportQueue | undefined>;
  createSupportQueue(q: InsertSupportQueue): Promise<SupportQueue>;
  updateSupportQueue(id: string, updates: Partial<InsertSupportQueue>): Promise<SupportQueue>;
  deleteSupportQueue(id: string): Promise<void>;

  // Queue Members & auto-assignment
  getSupportQueueMembers(queueId: string): Promise<Array<SupportQueueMember & { user: { id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean } | null }>>;
  getSupportQueueMemberIds(queueId: string): Promise<string[]>;
  addSupportQueueMember(queueId: string, userId: string): Promise<SupportQueueMember>;
  removeSupportQueueMember(queueId: string, userId: string): Promise<void>;
  setSupportQueueMembers(queueId: string, userIds: string[]): Promise<void>;
  getNextQueueAssignee(queueId: string): Promise<string | null>;
  bumpQueueRoundRobin(queueId: string, userId: string): Promise<void>;

  // SLA Policies
  getSupportSlaPolicies(tenantId: string): Promise<SupportSlaPolicy[]>;
  getSupportSlaPolicyById(id: string): Promise<SupportSlaPolicy | undefined>;
  findMatchingSlaPolicy(tenantId: string, priority: string, ticketType?: string): Promise<SupportSlaPolicy | undefined>;
  createSupportSlaPolicy(p: InsertSupportSlaPolicy): Promise<SupportSlaPolicy>;
  updateSupportSlaPolicy(id: string, updates: Partial<InsertSupportSlaPolicy>): Promise<SupportSlaPolicy>;
  deleteSupportSlaPolicy(id: string): Promise<void>;

  // KB Articles
  getSupportKbArticles(tenantId: string, opts?: { visibility?: string; published?: boolean; search?: string }): Promise<SupportKbArticle[]>;
  getSupportKbArticleBySlug(tenantId: string, slug: string): Promise<SupportKbArticle | undefined>;
  getSupportKbArticleById(id: string): Promise<SupportKbArticle | undefined>;
  createSupportKbArticle(a: InsertSupportKbArticle): Promise<SupportKbArticle>;
  updateSupportKbArticle(id: string, updates: Partial<InsertSupportKbArticle>): Promise<SupportKbArticle>;
  deleteSupportKbArticle(id: string): Promise<void>;
  incrementKbArticleViewCount(id: string): Promise<void>;

  // App Integration Keys
  getSupportAppIntegrationKeys(tenantId: string): Promise<SupportAppIntegrationKey[]>;
  getSupportAppIntegrationKeyById(id: string): Promise<SupportAppIntegrationKey | undefined>;
  getSupportAppIntegrationKeysByPrefix(prefix: string): Promise<SupportAppIntegrationKey[]>;
  createSupportAppIntegrationKey(k: InsertSupportAppIntegrationKey): Promise<SupportAppIntegrationKey>;
  revokeSupportAppIntegrationKey(id: string): Promise<void>;
  touchSupportAppIntegrationKey(id: string): Promise<void>;

  // Support Tickets
  getSupportTicketsByUserId(userId: string): Promise<SupportTicket[]>;
  getSupportTicketsByTenantId(tenantId: string, status?: string): Promise<SupportTicket[]>;
  getAllSupportTickets(filters?: {
    status?: string | string[];
    priority?: string;
    category?: string;
    tenantId?: string;
    assignedTo?: string;
    unassigned?: boolean;
    queueId?: string;
    queueIds?: string[];
    ticketType?: string;
    search?: string;
    breachingBefore?: Date;
    breachingAfter?: Date;
    closedSince?: Date;
  }): Promise<SupportTicket[]>;
  getSupportTicketById(id: string): Promise<SupportTicket | undefined>;
  getSupportTicketsByIds(ids: string[]): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  getSupportTicketByPortalToken(token: string): Promise<SupportTicket | undefined>;
  getSupportTicketByNumberAndEmail(tenantId: string, ticketNumber: number, email: string): Promise<SupportTicket | undefined>;

  // Replies, Watchers, Activity
  getSupportTicketReplies(ticketId: string, includeInternal?: boolean): Promise<SupportTicketReply[]>;
  createSupportTicketReply(reply: InsertSupportTicketReply): Promise<SupportTicketReply>;
  getSupportTicketWatchers(ticketId: string): Promise<SupportTicketWatcher[]>;
  addSupportTicketWatcher(w: InsertSupportTicketWatcher): Promise<SupportTicketWatcher>;
  removeSupportTicketWatcher(id: string): Promise<void>;
  getSupportTicketActivity(ticketId: string): Promise<SupportTicketActivity[]>;
  logSupportTicketActivity(a: InsertSupportTicketActivity): Promise<SupportTicketActivity>;

  // Planner Sync
  createSupportTicketPlannerSync(sync: InsertSupportTicketPlannerSync): Promise<SupportTicketPlannerSync>;
  getSupportTicketPlannerSyncByTicketId(ticketId: string): Promise<SupportTicketPlannerSync | undefined>;
  getSupportTicketPlannerSyncByTaskId(taskId: string): Promise<SupportTicketPlannerSync | undefined>;
  getSupportTicketPlannerSyncsByTenant(tenantId: string): Promise<SupportTicketPlannerSync[]>;
  updateSupportTicketPlannerSync(id: string, updates: Partial<InsertSupportTicketPlannerSync>): Promise<SupportTicketPlannerSync>;
  getTenantsWithSupportPlannerEnabled(): Promise<Tenant[]>;

  // Saved Filters
  getSupportSavedFilters(userId: string, tenantId?: string | null): Promise<SupportSavedFilter[]>;
  createSupportSavedFilter(f: InsertSupportSavedFilter): Promise<SupportSavedFilter>;
  updateSupportSavedFilter(id: string, userId: string, updates: Partial<InsertSupportSavedFilter>): Promise<SupportSavedFilter | undefined>;
  deleteSupportSavedFilter(id: string, userId: string): Promise<void>;

  // Search & Analytics
  searchSupportTickets(opts: { tenantId?: string | null; q: string; limit?: number }): Promise<Array<SupportTicket & { rank: number; snippet: string | null }>>;
  searchSupportTicketReplies(opts: { tenantId?: string | null; q: string; limit?: number }): Promise<Array<{ id: string; ticketId: string; rank: number; snippet: string | null }>>;
  getSupportAnalytics(tenantId?: string | null): Promise<any>;
  getSupportKbAnalytics(tenantId: string, windowDays: number): Promise<any>;
  getSupportMetricsForAppKey(tenantId: string, appKeyId: string): Promise<{ open: number; awaitingCustomer: number; breachRate7d: number }>;
  // Wave 2 dashboards
  getSlaAttainmentDashboard(tenantId: string | null, windowDays: number): Promise<any>;
  getBacklogAgingDashboard(tenantId: string | null): Promise<any>;
  getAgentPerformanceDashboard(tenantId: string | null, windowDays: number): Promise<any>;

  // Agent Card Health
  saveAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck>;
  addAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck>;
  getAgentCardHealthChecks(limit?: number): Promise<AgentCardHealthCheck[]>;
  pruneAgentCardHealthHistory(olderThanDays: number): Promise<number>;

  // Scheduled job runs (telemetry + heartbeat)
  createScheduledJobRun(run: Partial<InsertScheduledJobRun>): Promise<ScheduledJobRun>;
  updateScheduledJobRun(id: string, updates: Partial<ScheduledJobRun>): Promise<ScheduledJobRun>;
  getLastScheduledJobRun(jobType: string): Promise<ScheduledJobRun | undefined>;
  getLastSuccessfulScheduledJobRun(jobType: string): Promise<ScheduledJobRun | undefined>;
}

export class DbStorage implements IStorage {
  // ==================== Users ====================
  async getUser(id: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return u;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [u] = await db.insert(users).values(insertUser).returning();
    return u;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return u;
  }

  async getPlatformAdminEmails(): Promise<string[]> {
    const admins = await db.select({ email: users.email })
      .from(users)
      .where(and(
        or(eq(users.platformRole, 'global_admin'), eq(users.platformRole, 'constellation_admin')),
        isNotNull(users.email),
      ));
    return admins.map(a => a.email).filter(Boolean) as string[];
  }

  // ==================== Tenants ====================
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
    return t;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return t;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(asc(tenants.name));
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const [t] = await db.update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return t;
  }

  // ==================== Blocked Domains ====================
  async getBlockedDomains(): Promise<BlockedDomain[]> {
    return db.select().from(blockedDomains).orderBy(asc(blockedDomains.domain));
  }

  async isDomainBlocked(domain: string): Promise<boolean> {
    const lower = domain.toLowerCase();
    const [row] = await db.select().from(blockedDomains)
      .where(sql`LOWER(${blockedDomains.domain}) = ${lower}`)
      .limit(1);
    return !!row;
  }

  // ==================== System Settings ====================
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [s] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key));
    return s;
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings).orderBy(asc(systemSettings.settingKey));
  }

  async getSystemSettingValue(key: string, defaultValue?: string): Promise<string> {
    const s = await this.getSystemSetting(key);
    return s?.settingValue || defaultValue || '';
  }

  async setSystemSetting(key: string, value: string, description?: string, settingType: string = 'string'): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ settingValue: value, description: description ?? existing.description, settingType, updatedAt: sql`now()` })
        .where(eq(systemSettings.settingKey, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings)
      .values({ settingKey: key, settingValue: value, description, settingType })
      .returning();
    return created;
  }

  async deleteSystemSetting(id: string): Promise<void> {
    await db.delete(systemSettings).where(eq(systemSettings.id, id));
  }

  // ==================== Grounding Documents ====================
  async getGroundingDocuments(tenantId?: string | null, opts?: { isActive?: boolean }): Promise<GroundingDocument[]> {
    const conds: SQL[] = [];
    if (tenantId !== undefined) {
      if (tenantId === null) {
        conds.push(sql`${groundingDocuments.tenantId} IS NULL`);
      } else {
        conds.push(eq(groundingDocuments.tenantId, tenantId));
      }
    }
    if (opts?.isActive !== undefined) conds.push(eq(groundingDocuments.isActive, opts.isActive));
    const q = conds.length > 0
      ? db.select().from(groundingDocuments).where(and(...conds))
      : db.select().from(groundingDocuments);
    return q.orderBy(desc(groundingDocuments.priority), asc(groundingDocuments.title));
  }

  async getGroundingDocument(id: string): Promise<GroundingDocument | undefined> {
    const [d] = await db.select().from(groundingDocuments).where(eq(groundingDocuments.id, id));
    return d;
  }

  async createGroundingDocument(doc: InsertGroundingDocument): Promise<GroundingDocument> {
    const [created] = await db.insert(groundingDocuments).values(doc).returning();
    return created;
  }

  async updateGroundingDocument(id: string, updates: Partial<InsertGroundingDocument>): Promise<GroundingDocument> {
    const [updated] = await db.update(groundingDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(groundingDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteGroundingDocument(id: string): Promise<void> {
    await db.delete(groundingDocuments).where(eq(groundingDocuments.id, id));
  }

  // ==================== Support Queues ====================
  async getSupportQueues(tenantId: string): Promise<SupportQueue[]> {
    return db.select().from(supportQueues)
      .where(eq(supportQueues.tenantId, tenantId))
      .orderBy(supportQueues.sortOrder, supportQueues.name);
  }

  async getSupportQueueById(id: string): Promise<SupportQueue | undefined> {
    const [q] = await db.select().from(supportQueues).where(eq(supportQueues.id, id));
    return q;
  }

  async createSupportQueue(q: InsertSupportQueue): Promise<SupportQueue> {
    const [created] = await db.insert(supportQueues).values(q).returning();
    return created;
  }

  async updateSupportQueue(id: string, updates: Partial<InsertSupportQueue>): Promise<SupportQueue> {
    const [updated] = await db.update(supportQueues)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportQueues.id, id)).returning();
    return updated;
  }

  async deleteSupportQueue(id: string): Promise<void> {
    await db.delete(supportQueues).where(eq(supportQueues.id, id));
  }

  // ==================== Support Queue Members ====================
  async getSupportQueueMembers(queueId: string): Promise<Array<SupportQueueMember & { user: { id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean } | null }>> {
    const rows = await db.select({
      id: supportQueueMembers.id,
      queueId: supportQueueMembers.queueId,
      userId: supportQueueMembers.userId,
      createdAt: supportQueueMembers.createdAt,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        isActive: users.isActive,
      },
    }).from(supportQueueMembers)
      .leftJoin(users, eq(users.id, supportQueueMembers.userId))
      .where(eq(supportQueueMembers.queueId, queueId));
    return rows as any;
  }

  async getSupportQueueMemberIds(queueId: string): Promise<string[]> {
    const rows = await db.select({ userId: supportQueueMembers.userId })
      .from(supportQueueMembers)
      .where(eq(supportQueueMembers.queueId, queueId));
    return rows.map(r => r.userId);
  }

  async addSupportQueueMember(queueId: string, userId: string): Promise<SupportQueueMember> {
    const [created] = await db.insert(supportQueueMembers)
      .values({ queueId, userId })
      .onConflictDoNothing({ target: [supportQueueMembers.queueId, supportQueueMembers.userId] })
      .returning();
    if (created) return created;
    const [existing] = await db.select().from(supportQueueMembers)
      .where(and(eq(supportQueueMembers.queueId, queueId), eq(supportQueueMembers.userId, userId)));
    return existing;
  }

  async removeSupportQueueMember(queueId: string, userId: string): Promise<void> {
    await db.delete(supportQueueMembers).where(and(
      eq(supportQueueMembers.queueId, queueId),
      eq(supportQueueMembers.userId, userId),
    ));
  }

  async setSupportQueueMembers(queueId: string, userIds: string[]): Promise<void> {
    const unique = Array.from(new Set(userIds));
    await db.delete(supportQueueMembers).where(and(
      eq(supportQueueMembers.queueId, queueId),
      unique.length > 0 ? sql`${supportQueueMembers.userId} NOT IN (${sql.join(unique.map(u => sql`${u}`), sql`, `)})` : sql`true`,
    ));
    if (unique.length > 0) {
      await db.insert(supportQueueMembers)
        .values(unique.map(userId => ({ queueId, userId })))
        .onConflictDoNothing({ target: [supportQueueMembers.queueId, supportQueueMembers.userId] });
    }
  }

  // ==================== Round-robin / least-loaded auto-assignment ====================
  async getNextQueueAssignee(queueId: string): Promise<string | null> {
    const memberRows = await db.select({
      userId: supportQueueMembers.userId,
      isActive: users.isActive,
    }).from(supportQueueMembers)
      .leftJoin(users, eq(users.id, supportQueueMembers.userId))
      .where(eq(supportQueueMembers.queueId, queueId));
    const activeMembers = memberRows.filter(r => r.isActive !== false).map(r => r.userId);
    if (activeMembers.length === 0) return null;

    const counts = new Map<string, number>();
    for (const uid of activeMembers) counts.set(uid, 0);
    const openCounts = await db.select({
      assignedTo: supportTickets.assignedTo,
      count: sql<number>`cast(count(*) as int)`.as('count'),
    }).from(supportTickets)
      .where(and(
        inArray(supportTickets.assignedTo, activeMembers),
        inArray(supportTickets.status, ['new', 'open', 'in_progress', 'pending', 'on_hold']),
      ))
      .groupBy(supportTickets.assignedTo);
    for (const row of openCounts) {
      if (row.assignedTo) counts.set(row.assignedTo, Number(row.count) || 0);
    }

    let minLoad = Infinity;
    for (const c of Array.from(counts.values())) if (c < minLoad) minLoad = c;
    const candidates = activeMembers.filter(uid => (counts.get(uid) ?? 0) === minLoad);
    if (candidates.length === 1) {
      const chosen = candidates[0];
      await this.bumpQueueRoundRobin(queueId, chosen);
      return chosen;
    }

    const [state] = await db.select().from(supportQueueRoundRobinState)
      .where(eq(supportQueueRoundRobinState.queueId, queueId));
    const last = state?.lastAssignedUserId || null;
    const ordered = activeMembers.filter(uid => candidates.includes(uid));
    let chosen: string;
    if (!last) {
      chosen = ordered[0];
    } else {
      const idx = ordered.indexOf(last);
      chosen = idx === -1 ? ordered[0] : ordered[(idx + 1) % ordered.length];
    }
    await this.bumpQueueRoundRobin(queueId, chosen);
    return chosen;
  }

  async bumpQueueRoundRobin(queueId: string, userId: string): Promise<void> {
    await db.insert(supportQueueRoundRobinState)
      .values({ queueId, lastAssignedUserId: userId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: supportQueueRoundRobinState.queueId,
        set: { lastAssignedUserId: userId, updatedAt: new Date() },
      });
  }

  // ==================== SLA Policies ====================
  async getSupportSlaPolicies(tenantId: string): Promise<SupportSlaPolicy[]> {
    return db.select().from(supportSlaPolicies)
      .where(eq(supportSlaPolicies.tenantId, tenantId))
      .orderBy(supportSlaPolicies.priority);
  }

  async getSupportSlaPolicyById(id: string): Promise<SupportSlaPolicy | undefined> {
    const [p] = await db.select().from(supportSlaPolicies).where(eq(supportSlaPolicies.id, id));
    return p;
  }

  async findMatchingSlaPolicy(tenantId: string, priority: string, ticketType?: string): Promise<SupportSlaPolicy | undefined> {
    const rows = await db.select().from(supportSlaPolicies).where(and(
      eq(supportSlaPolicies.tenantId, tenantId),
      eq(supportSlaPolicies.priority, priority),
      eq(supportSlaPolicies.isActive, true),
    ));
    if (ticketType) {
      const exact = rows.find(r => r.ticketType === ticketType);
      if (exact) return exact;
    }
    return rows.find(r => !r.ticketType) || rows[0];
  }

  async createSupportSlaPolicy(p: InsertSupportSlaPolicy): Promise<SupportSlaPolicy> {
    const [created] = await db.insert(supportSlaPolicies).values(p).returning();
    return created;
  }

  async updateSupportSlaPolicy(id: string, updates: Partial<InsertSupportSlaPolicy>): Promise<SupportSlaPolicy> {
    const [updated] = await db.update(supportSlaPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportSlaPolicies.id, id)).returning();
    return updated;
  }

  async deleteSupportSlaPolicy(id: string): Promise<void> {
    await db.delete(supportSlaPolicies).where(eq(supportSlaPolicies.id, id));
  }

  // ==================== KB Articles ====================
  async getSupportKbArticles(tenantId: string, opts?: { visibility?: string; published?: boolean; search?: string }): Promise<SupportKbArticle[]> {
    const conds: SQL[] = [eq(supportKbArticles.tenantId, tenantId)];
    if (opts?.visibility) conds.push(eq(supportKbArticles.visibility, opts.visibility));
    if (opts?.published) conds.push(isNotNull(supportKbArticles.publishedAt));
    if (opts?.search) conds.push(ilike(supportKbArticles.title, `%${opts.search}%`));
    return db.select().from(supportKbArticles).where(and(...conds)).orderBy(desc(supportKbArticles.updatedAt));
  }

  async getSupportKbArticleBySlug(tenantId: string, slug: string): Promise<SupportKbArticle | undefined> {
    const [a] = await db.select().from(supportKbArticles)
      .where(and(eq(supportKbArticles.tenantId, tenantId), eq(supportKbArticles.slug, slug)));
    return a;
  }

  async getSupportKbArticleById(id: string): Promise<SupportKbArticle | undefined> {
    const [a] = await db.select().from(supportKbArticles).where(eq(supportKbArticles.id, id));
    return a;
  }

  async createSupportKbArticle(a: InsertSupportKbArticle): Promise<SupportKbArticle> {
    const [created] = await db.insert(supportKbArticles).values(a).returning();
    return created;
  }

  async updateSupportKbArticle(id: string, updates: Partial<InsertSupportKbArticle>): Promise<SupportKbArticle> {
    const [updated] = await db.update(supportKbArticles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportKbArticles.id, id)).returning();
    return updated;
  }

  async deleteSupportKbArticle(id: string): Promise<void> {
    await db.delete(supportKbArticles).where(eq(supportKbArticles.id, id));
  }

  async incrementKbArticleViewCount(id: string): Promise<void> {
    await db.update(supportKbArticles)
      .set({ viewCount: sql`${supportKbArticles.viewCount} + 1` })
      .where(eq(supportKbArticles.id, id));
  }

  // ==================== App Integration Keys ====================
  async getSupportAppIntegrationKeys(tenantId: string): Promise<SupportAppIntegrationKey[]> {
    return db.select().from(supportAppIntegrationKeys)
      .where(eq(supportAppIntegrationKeys.tenantId, tenantId))
      .orderBy(desc(supportAppIntegrationKeys.createdAt));
  }

  async getSupportAppIntegrationKeyById(id: string): Promise<SupportAppIntegrationKey | undefined> {
    const [k] = await db.select().from(supportAppIntegrationKeys).where(eq(supportAppIntegrationKeys.id, id));
    return k;
  }

  async getSupportAppIntegrationKeysByPrefix(prefix: string): Promise<SupportAppIntegrationKey[]> {
    return db.select().from(supportAppIntegrationKeys).where(eq(supportAppIntegrationKeys.keyPrefix, prefix));
  }

  async createSupportAppIntegrationKey(k: InsertSupportAppIntegrationKey): Promise<SupportAppIntegrationKey> {
    const [created] = await db.insert(supportAppIntegrationKeys).values(k).returning();
    return created;
  }

  async revokeSupportAppIntegrationKey(id: string): Promise<void> {
    await db.update(supportAppIntegrationKeys)
      .set({ revokedAt: new Date() })
      .where(eq(supportAppIntegrationKeys.id, id));
  }

  async touchSupportAppIntegrationKey(id: string): Promise<void> {
    await db.update(supportAppIntegrationKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(supportAppIntegrationKeys.id, id));
  }

  // ==================== Support Tickets ====================
  async getSupportTicketsByUserId(userId: string): Promise<SupportTicket[]> {
    return db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketsByTenantId(tenantId: string, status?: string): Promise<SupportTicket[]> {
    const conds: SQL[] = [eq(supportTickets.tenantId, tenantId)];
    if (status) conds.push(eq(supportTickets.status, status));
    return db.select().from(supportTickets)
      .where(and(...conds))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllSupportTickets(filters?: {
    status?: string | string[];
    priority?: string;
    category?: string;
    tenantId?: string;
    assignedTo?: string;
    unassigned?: boolean;
    queueId?: string;
    queueIds?: string[];
    ticketType?: string;
    search?: string;
    breachingBefore?: Date;
    breachingAfter?: Date;
    closedSince?: Date;
  }): Promise<SupportTicket[]> {
    const conds: SQL[] = [];
    if (filters?.status) {
      if (Array.isArray(filters.status)) conds.push(inArray(supportTickets.status, filters.status));
      else conds.push(eq(supportTickets.status, filters.status));
    }
    if (filters?.priority) conds.push(eq(supportTickets.priority, filters.priority));
    if (filters?.category) conds.push(eq(supportTickets.category, filters.category));
    if (filters?.tenantId) conds.push(eq(supportTickets.tenantId, filters.tenantId));
    if (filters?.assignedTo) conds.push(eq(supportTickets.assignedTo, filters.assignedTo));
    if (filters?.unassigned) conds.push(isNull(supportTickets.assignedTo));
    if (filters?.queueId) conds.push(eq(supportTickets.queueId, filters.queueId));
    if (filters?.queueIds && filters.queueIds.length > 0) conds.push(inArray(supportTickets.queueId, filters.queueIds));
    if (filters?.ticketType) conds.push(eq(supportTickets.ticketType, filters.ticketType));
    if (filters?.search) {
      // Prefer FTS via the generated tsvector column when present; fall back
      // to ILIKE so this still works on databases that haven't run the FTS
      // migration yet.
      const term = `%${filters.search}%`;
      const searchCond = or(
        sql`${supportTickets}.search_vector @@ websearch_to_tsquery('english', ${filters.search})`,
        ilike(supportTickets.subject, term),
        ilike(supportTickets.description, term),
      );
      if (searchCond) conds.push(searchCond);
    }
    if (filters?.breachingBefore) conds.push(lte(supportTickets.resolutionDueAt, filters.breachingBefore));
    if (filters?.breachingAfter) conds.push(gte(supportTickets.resolutionDueAt, filters.breachingAfter));
    if (filters?.closedSince) conds.push(gte(supportTickets.closedAt, filters.closedSince));
    const q = conds.length > 0
      ? db.select().from(supportTickets).where(and(...conds))
      : db.select().from(supportTickets);
    return q.orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketById(id: string): Promise<SupportTicket | undefined> {
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return t;
  }

  async getSupportTicketsByIds(ids: string[]): Promise<SupportTicket[]> {
    if (!ids.length) return [];
    return db.select().from(supportTickets).where(inArray(supportTickets.id, ids));
  }

  private async getNextTicketNumber(): Promise<number> {
    const result = await db.select({ maxNum: sql<number>`COALESCE(MAX(${supportTickets.ticketNumber}), 0)` })
      .from(supportTickets);
    return (result[0]?.maxNum || 0) + 1;
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketNumber = await this.getNextTicketNumber();
    const [created] = await db.insert(supportTickets).values({
      ...ticket,
      ticketNumber,
      applicationSource: ticket.applicationSource ?? 'Palomar',
    }).returning();
    return created;
  }

  async updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const [updated] = await db.update(supportTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async getSupportTicketByPortalToken(token: string): Promise<SupportTicket | undefined> {
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.portalToken, token));
    return t;
  }

  async getSupportTicketByNumberAndEmail(tenantId: string, ticketNumber: number, email: string): Promise<SupportTicket | undefined> {
    const lower = email.toLowerCase();
    const rows = await db.select().from(supportTickets).where(and(
      eq(supportTickets.tenantId, tenantId),
      eq(supportTickets.ticketNumber, ticketNumber),
    )).limit(1);
    const t = rows[0];
    if (!t) return undefined;
    if (t.externalRequesterEmail && t.externalRequesterEmail.toLowerCase() === lower) return t;
    if (t.userId) {
      const [u] = await db.select().from(users).where(eq(users.id, t.userId));
      if (u?.email?.toLowerCase() === lower) return t;
    }
    return undefined;
  }

  // ==================== Replies ====================
  async getSupportTicketReplies(ticketId: string, includeInternal: boolean = false): Promise<SupportTicketReply[]> {
    const conds: SQL[] = [eq(supportTicketReplies.ticketId, ticketId)];
    if (!includeInternal) conds.push(eq(supportTicketReplies.isInternal, false));
    return db.select().from(supportTicketReplies)
      .where(and(...conds))
      .orderBy(supportTicketReplies.createdAt);
  }

  async createSupportTicketReply(reply: InsertSupportTicketReply): Promise<SupportTicketReply> {
    const [created] = await db.insert(supportTicketReplies).values(reply).returning();
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, reply.ticketId));
    return created;
  }

  // ==================== Watchers & Activity ====================
  async getSupportTicketWatchers(ticketId: string): Promise<SupportTicketWatcher[]> {
    return db.select().from(supportTicketWatchers).where(eq(supportTicketWatchers.ticketId, ticketId));
  }

  async addSupportTicketWatcher(w: InsertSupportTicketWatcher): Promise<SupportTicketWatcher> {
    const [created] = await db.insert(supportTicketWatchers).values(w).returning();
    return created;
  }

  async removeSupportTicketWatcher(id: string): Promise<void> {
    await db.delete(supportTicketWatchers).where(eq(supportTicketWatchers.id, id));
  }

  async getSupportTicketActivity(ticketId: string): Promise<SupportTicketActivity[]> {
    return db.select().from(supportTicketActivity)
      .where(eq(supportTicketActivity.ticketId, ticketId))
      .orderBy(supportTicketActivity.createdAt);
  }

  async logSupportTicketActivity(a: InsertSupportTicketActivity): Promise<SupportTicketActivity> {
    const [created] = await db.insert(supportTicketActivity).values(a).returning();
    return created;
  }

  // ==================== Planner Sync ====================
  async createSupportTicketPlannerSync(sync: InsertSupportTicketPlannerSync): Promise<SupportTicketPlannerSync> {
    const [created] = await db.insert(supportTicketPlannerSync).values(sync).returning();
    return created;
  }

  async getSupportTicketPlannerSyncByTicketId(ticketId: string): Promise<SupportTicketPlannerSync | undefined> {
    const [r] = await db.select().from(supportTicketPlannerSync)
      .where(eq(supportTicketPlannerSync.ticketId, ticketId));
    return r;
  }

  async getSupportTicketPlannerSyncByTaskId(taskId: string): Promise<SupportTicketPlannerSync | undefined> {
    const [r] = await db.select().from(supportTicketPlannerSync)
      .where(eq(supportTicketPlannerSync.taskId, taskId));
    return r;
  }

  async getSupportTicketPlannerSyncsByTenant(tenantId: string): Promise<SupportTicketPlannerSync[]> {
    return db.select().from(supportTicketPlannerSync)
      .where(eq(supportTicketPlannerSync.tenantId, tenantId));
  }

  async updateSupportTicketPlannerSync(id: string, updates: Partial<InsertSupportTicketPlannerSync>): Promise<SupportTicketPlannerSync> {
    const [updated] = await db.update(supportTicketPlannerSync)
      .set({ ...updates, lastSyncedAt: new Date() })
      .where(eq(supportTicketPlannerSync.id, id))
      .returning();
    return updated;
  }

  async getTenantsWithSupportPlannerEnabled(): Promise<Tenant[]> {
    return db.select().from(tenants).where(and(
      eq(tenants.supportPlannerEnabled, true),
      isNotNull(tenants.supportPlannerPlanId),
    ));
  }

  // ==================== Saved Filters ====================
  async getSupportSavedFilters(userId: string, tenantId?: string | null): Promise<SupportSavedFilter[]> {
    const conds: SQL[] = [eq(supportSavedFilters.userId, userId)];
    if (tenantId) conds.push(eq(supportSavedFilters.tenantId, tenantId));
    return db.select().from(supportSavedFilters)
      .where(and(...conds))
      .orderBy(desc(supportSavedFilters.isPinned), supportSavedFilters.sortOrder, supportSavedFilters.name);
  }

  async createSupportSavedFilter(f: InsertSupportSavedFilter): Promise<SupportSavedFilter> {
    const [created] = await db.insert(supportSavedFilters).values(f).returning();
    return created;
  }

  async updateSupportSavedFilter(id: string, userId: string, updates: Partial<InsertSupportSavedFilter>): Promise<SupportSavedFilter | undefined> {
    const [updated] = await db.update(supportSavedFilters)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(supportSavedFilters.id, id), eq(supportSavedFilters.userId, userId)))
      .returning();
    return updated;
  }

  async deleteSupportSavedFilter(id: string, userId: string): Promise<void> {
    await db.delete(supportSavedFilters)
      .where(and(eq(supportSavedFilters.id, id), eq(supportSavedFilters.userId, userId)));
  }

  // ==================== FTS Search ====================
  async searchSupportTickets(opts: { tenantId?: string | null; q: string; limit?: number }): Promise<Array<SupportTicket & { rank: number; snippet: string | null }>> {
    const limit = Math.min(opts.limit || 50, 200);
    const cond = opts.tenantId
      ? sql`${supportTickets.tenantId} = ${opts.tenantId} AND search_vector @@ websearch_to_tsquery('english', ${opts.q})`
      : sql`search_vector @@ websearch_to_tsquery('english', ${opts.q})`;
    const rows = await db.execute(sql`
      SELECT ${supportTickets}.*,
             ts_rank(search_vector, websearch_to_tsquery('english', ${opts.q})) AS rank,
             ts_headline('english', coalesce(description,''), websearch_to_tsquery('english', ${opts.q}),
               'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=20,MinWords=8') AS snippet
      FROM ${supportTickets}
      WHERE ${cond}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    return ((rows as any).rows || rows) as any;
  }

  async searchSupportTicketReplies(opts: { tenantId?: string | null; q: string; limit?: number }): Promise<Array<{ id: string; ticketId: string; rank: number; snippet: string | null }>> {
    const limit = Math.min(opts.limit || 50, 200);
    const tenantJoin = opts.tenantId ? sql`AND t.tenant_id = ${opts.tenantId}` : sql``;
    const rows = await db.execute(sql`
      SELECT r.id, r.ticket_id AS "ticketId",
             ts_rank(r.search_vector, websearch_to_tsquery('english', ${opts.q})) AS rank,
             ts_headline('english', coalesce(r.message,''), websearch_to_tsquery('english', ${opts.q}),
               'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=20,MinWords=8') AS snippet
      FROM support_ticket_replies r
      JOIN support_tickets t ON t.id = r.ticket_id
      WHERE r.search_vector @@ websearch_to_tsquery('english', ${opts.q}) ${tenantJoin}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    return ((rows as any).rows || rows) as any;
  }

  // ==================== Analytics ====================
  async getSupportAnalytics(tenantId?: string | null): Promise<any> {
    const tenantCond = tenantId ? sql`tenant_id = ${tenantId}` : sql`1=1`;

    const summary = await db.execute(sql`
      SELECT
        SUM(CASE WHEN status IN ('new','open','in_progress') THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN status IN ('pending','on_hold') THEN 1 ELSE 0 END)::int AS "awaitingCustomer",
        SUM(CASE WHEN status IN ('resolved','closed') AND (resolved_at >= now() - interval '7 days' OR closed_at >= now() - interval '7 days') THEN 1 ELSE 0 END)::int AS "resolved7d",
        SUM(CASE WHEN created_at >= now() - interval '7 days' THEN 1 ELSE 0 END)::int AS "created7d",
        ROUND(AVG(CASE WHEN csat_score IS NOT NULL AND csat_submitted_at >= now() - interval '30 days' THEN csat_score END)::numeric, 2)::float AS "csatAvg30d",
        COALESCE(
          SUM(CASE WHEN sla_breached = true AND created_at >= now() - interval '7 days' THEN 1 ELSE 0 END)::float
          / NULLIF(SUM(CASE WHEN created_at >= now() - interval '7 days' THEN 1 ELSE 0 END), 0)
        , 0)::float AS "breachRate7d"
      FROM support_tickets WHERE ${tenantCond}
    `);
    const sumRow: any = ((summary as any).rows || summary)[0] || {};

    const volume = await db.execute(sql`
      WITH days AS (
        SELECT generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day')::date AS day
      )
      SELECT to_char(d.day,'YYYY-MM-DD') AS day,
        COALESCE(SUM(CASE WHEN date_trunc('day', t.created_at)::date = d.day THEN 1 ELSE 0 END),0)::int AS created,
        COALESCE(SUM(CASE WHEN date_trunc('day', COALESCE(t.resolved_at, t.closed_at))::date = d.day THEN 1 ELSE 0 END),0)::int AS resolved
      FROM days d
      LEFT JOIN support_tickets t ON ${tenantCond} AND (
        date_trunc('day', t.created_at)::date = d.day
        OR date_trunc('day', COALESCE(t.resolved_at, t.closed_at))::date = d.day
      )
      GROUP BY d.day ORDER BY d.day
    `);

    const byPriority = await db.execute(sql`SELECT priority, COUNT(*)::int AS count FROM support_tickets WHERE ${tenantCond} AND status NOT IN ('closed','cancelled') GROUP BY priority ORDER BY count DESC`);
    const byCategory = await db.execute(sql`SELECT category, COUNT(*)::int AS count FROM support_tickets WHERE ${tenantCond} AND created_at >= now() - interval '30 days' GROUP BY category ORDER BY count DESC`);
    const bySource = await db.execute(sql`SELECT COALESCE(source,'unknown') AS source, COUNT(*)::int AS count FROM support_tickets WHERE ${tenantCond} AND created_at >= now() - interval '30 days' GROUP BY source ORDER BY count DESC`);
    const byApp = await db.execute(sql`SELECT COALESCE(application_source,'unknown') AS application, COUNT(*)::int AS count FROM support_tickets WHERE ${tenantCond} AND created_at >= now() - interval '30 days' GROUP BY application_source ORDER BY count DESC LIMIT 10`);

    const rt = await db.execute(sql`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at))/60)::float AS "medianFirstResponseMinutes",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(resolved_at, closed_at) - created_at))/60)::float AS "medianResolutionMinutes"
      FROM support_tickets
      WHERE ${tenantCond} AND created_at >= now() - interval '30 days'
    `);
    const rtRow: any = ((rt as any).rows || rt)[0] || {};

    return {
      summary: {
        open: sumRow.open || 0,
        awaitingCustomer: sumRow.awaitingCustomer || 0,
        resolved7d: sumRow.resolved7d || 0,
        created7d: sumRow.created7d || 0,
        csatAvg30d: sumRow.csatAvg30d ?? null,
        breachRate7d: sumRow.breachRate7d || 0,
      },
      volumeByDay: ((volume as any).rows || volume) as any[],
      byPriority: ((byPriority as any).rows || byPriority) as any[],
      byCategory: ((byCategory as any).rows || byCategory) as any[],
      bySource: ((bySource as any).rows || bySource) as any[],
      byApplication: ((byApp as any).rows || byApp) as any[],
      responseTimes: {
        medianFirstResponseMinutes: rtRow.medianFirstResponseMinutes ?? null,
        medianResolutionMinutes: rtRow.medianResolutionMinutes ?? null,
      },
    };
  }

  async getSupportKbAnalytics(tenantId: string, windowDays: number): Promise<any> {
    const days = Math.max(1, Math.min(365, Math.floor(windowDays || 30)));
    const windowExpr = sql.raw(`interval '${days} days'`);

    // Per-article rollup: lifetime totals from supportKbArticles + windowed counts from supportEvents.
    const rows = await db.execute(sql`
      WITH ev AS (
        SELECT
          article_id,
          SUM(CASE WHEN event_type = 'kb_article_view' THEN 1 ELSE 0 END)::int AS views_window,
          SUM(CASE WHEN event_type = 'kb_helpful' THEN 1 ELSE 0 END)::int AS helpful_window,
          SUM(CASE WHEN event_type = 'kb_not_helpful' THEN 1 ELSE 0 END)::int AS not_helpful_window,
          SUM(CASE WHEN event_type = 'ticket_deflected' THEN 1 ELSE 0 END)::int AS deflections_window
        FROM support_events
        WHERE tenant_id = ${tenantId}
          AND article_id IS NOT NULL
          AND created_at >= now() - ${windowExpr}
        GROUP BY article_id
      )
      SELECT
        a.id,
        a.title,
        a.slug,
        a.visibility,
        a.published_at IS NOT NULL AS "isPublished",
        a.view_count::int AS "views",
        a.helpful_count::int AS "helpful",
        a.not_helpful_count::int AS "notHelpful",
        COALESCE(ev.views_window, 0)::int AS "viewsWindow",
        COALESCE(ev.helpful_window, 0)::int AS "helpfulWindow",
        COALESCE(ev.not_helpful_window, 0)::int AS "notHelpfulWindow",
        COALESCE(ev.deflections_window, 0)::int AS "deflectionsWindow"
      FROM support_kb_articles a
      LEFT JOIN ev ON ev.article_id = a.id
      WHERE a.tenant_id = ${tenantId}
      ORDER BY COALESCE(ev.deflections_window, 0) DESC, a.view_count DESC, a.title ASC
    `);
    const articles = ((rows as any).rows || rows) as any[];

    // Total deflections this calendar month (in tenant's server time).
    const monthRow = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM support_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'ticket_deflected'
        AND created_at >= date_trunc('month', now())
    `);
    const totalDeflectionsThisMonth = Number(((monthRow as any).rows || monthRow)[0]?.total || 0);

    // Total deflections in the chosen window.
    const winRow = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM support_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'ticket_deflected'
        AND created_at >= now() - ${windowExpr}
    `);
    const totalDeflectionsWindow = Number(((winRow as any).rows || winRow)[0]?.total || 0);

    return {
      windowDays: days,
      totalDeflectionsThisMonth,
      totalDeflectionsWindow,
      articles: articles.map((r) => {
        const helpfulSum = (r.helpful || 0) + (r.notHelpful || 0);
        const helpfulPct = helpfulSum > 0 ? Math.round((r.helpful / helpfulSum) * 100) : null;
        const helpfulSumWin = (r.helpfulWindow || 0) + (r.notHelpfulWindow || 0);
        const helpfulPctWindow = helpfulSumWin > 0 ? Math.round((r.helpfulWindow / helpfulSumWin) * 100) : null;
        return { ...r, helpfulPct, helpfulPctWindow };
      }),
    };
  }

  async getSupportMetricsForAppKey(tenantId: string, appKeyId: string): Promise<{ open: number; awaitingCustomer: number; breachRate7d: number }> {
    const r = await db.execute(sql`
      SELECT
        SUM(CASE WHEN status IN ('new','open','in_progress') THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN status IN ('pending','on_hold') THEN 1 ELSE 0 END)::int AS "awaitingCustomer",
        COALESCE(
          SUM(CASE WHEN sla_breached = true AND created_at >= now() - interval '7 days' THEN 1 ELSE 0 END)::float
          / NULLIF(SUM(CASE WHEN created_at >= now() - interval '7 days' THEN 1 ELSE 0 END), 0)
        , 0)::float AS "breachRate7d"
      FROM support_tickets
      WHERE tenant_id = ${tenantId} AND app_integration_key_id = ${appKeyId}
    `);
    const row: any = ((r as any).rows || r)[0] || {};
    return {
      open: row.open || 0,
      awaitingCustomer: row.awaitingCustomer || 0,
      breachRate7d: row.breachRate7d || 0,
    };
  }

  // ==================== Wave 2 Dashboards ====================
  async getSlaAttainmentDashboard(tenantId: string | null, windowDays: number): Promise<any> {
    const days = Math.max(1, Math.min(Math.floor(windowDays || 30), 365));
    // Two predicates: bare for single-table queries, alias-qualified for the
    // joined query against `support_queues` (which also has a `tenant_id`
    // column and would otherwise make the predicate ambiguous in SQL).
    const tenantCond = tenantId ? sql`tenant_id = ${tenantId}` : sql`1=1`;
    const tenantCondT = tenantId ? sql`t.tenant_id = ${tenantId}` : sql`1=1`;
    const windowExpr = sql.raw(`interval '${days} days'`);

    const overall = await db.execute(sql`
      WITH base AS (
        SELECT * FROM support_tickets
        WHERE ${tenantCond} AND created_at >= now() - ${windowExpr}
      )
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN first_response_due_at IS NOT NULL AND first_response_at IS NOT NULL AND first_response_at <= first_response_due_at THEN 1 ELSE 0 END)::int AS "frOnTime",
        SUM(CASE WHEN first_response_due_at IS NOT NULL AND (first_response_at IS NULL OR first_response_at > first_response_due_at) THEN 1 ELSE 0 END)::int AS "frBreached",
        SUM(CASE WHEN resolution_due_at IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at <= resolution_due_at THEN 1 ELSE 0 END)::int AS "resOnTime",
        SUM(CASE WHEN resolution_due_at IS NOT NULL AND (resolved_at IS NULL OR resolved_at > resolution_due_at) THEN 1 ELSE 0 END)::int AS "resBreached"
      FROM base
    `);
    const o: any = ((overall as any).rows || overall)[0] || {};

    const byPriority = await db.execute(sql`
      SELECT priority,
        COUNT(*)::int AS total,
        SUM(CASE WHEN first_response_due_at IS NOT NULL AND first_response_at IS NOT NULL AND first_response_at <= first_response_due_at THEN 1 ELSE 0 END)::int AS "frOnTime",
        SUM(CASE WHEN resolution_due_at IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at <= resolution_due_at THEN 1 ELSE 0 END)::int AS "resOnTime"
      FROM support_tickets
      WHERE ${tenantCond} AND created_at >= now() - ${windowExpr}
      GROUP BY priority ORDER BY priority
    `);

    const byQueue = await db.execute(sql`
      SELECT t.queue_id AS "queueId", q.name AS "queueName",
        COUNT(*)::int AS total,
        SUM(CASE WHEN t.first_response_due_at IS NOT NULL AND t.first_response_at IS NOT NULL AND t.first_response_at <= t.first_response_due_at THEN 1 ELSE 0 END)::int AS "frOnTime",
        SUM(CASE WHEN t.resolution_due_at IS NOT NULL AND t.resolved_at IS NOT NULL AND t.resolved_at <= t.resolution_due_at THEN 1 ELSE 0 END)::int AS "resOnTime"
      FROM support_tickets t LEFT JOIN support_queues q ON q.id = t.queue_id
      WHERE ${tenantCondT} AND t.created_at >= now() - ${windowExpr}
      GROUP BY t.queue_id, q.name ORDER BY total DESC
    `);

    return {
      windowDays: days,
      overall: {
        total: o.total || 0,
        frOnTime: o.frOnTime || 0,
        frBreached: o.frBreached || 0,
        resOnTime: o.resOnTime || 0,
        resBreached: o.resBreached || 0,
        frAttainmentPct: o.frOnTime + o.frBreached > 0 ? Math.round((o.frOnTime / (o.frOnTime + o.frBreached)) * 100) : null,
        resAttainmentPct: o.resOnTime + o.resBreached > 0 ? Math.round((o.resOnTime / (o.resOnTime + o.resBreached)) * 100) : null,
      },
      byPriority: ((byPriority as any).rows || byPriority) as any[],
      byQueue: ((byQueue as any).rows || byQueue) as any[],
    };
  }

  async getBacklogAgingDashboard(tenantId: string | null): Promise<any> {
    // See getSlaAttainmentDashboard for why we keep two predicates.
    const tenantCond = tenantId ? sql`tenant_id = ${tenantId}` : sql`1=1`;
    const tenantCondT = tenantId ? sql`t.tenant_id = ${tenantId}` : sql`1=1`;
    const buckets = await db.execute(sql`
      WITH base AS (
        SELECT id, queue_id, priority, EXTRACT(EPOCH FROM (now() - created_at))/86400 AS age_days
        FROM support_tickets
        WHERE ${tenantCond} AND status NOT IN ('resolved','closed','cancelled')
      )
      SELECT
        SUM(CASE WHEN age_days < 1 THEN 1 ELSE 0 END)::int AS "lt1d",
        SUM(CASE WHEN age_days >= 1 AND age_days < 3 THEN 1 ELSE 0 END)::int AS "d1to3",
        SUM(CASE WHEN age_days >= 3 AND age_days < 7 THEN 1 ELSE 0 END)::int AS "d3to7",
        SUM(CASE WHEN age_days >= 7 AND age_days < 30 THEN 1 ELSE 0 END)::int AS "d7to30",
        SUM(CASE WHEN age_days >= 30 THEN 1 ELSE 0 END)::int AS "gte30d",
        COUNT(*)::int AS total
      FROM base
    `);
    const bRow: any = ((buckets as any).rows || buckets)[0] || {};

    const byQueue = await db.execute(sql`
      SELECT t.queue_id AS "queueId", q.name AS "queueName", COUNT(*)::int AS open,
        AVG(EXTRACT(EPOCH FROM (now() - t.created_at))/86400)::float AS "avgAgeDays"
      FROM support_tickets t LEFT JOIN support_queues q ON q.id = t.queue_id
      WHERE ${tenantCondT} AND t.status NOT IN ('resolved','closed','cancelled')
      GROUP BY t.queue_id, q.name ORDER BY open DESC
    `);

    const byPriority = await db.execute(sql`
      SELECT priority, COUNT(*)::int AS open,
        AVG(EXTRACT(EPOCH FROM (now() - created_at))/86400)::float AS "avgAgeDays"
      FROM support_tickets WHERE ${tenantCond} AND status NOT IN ('resolved','closed','cancelled')
      GROUP BY priority ORDER BY open DESC
    `);

    return {
      buckets: {
        lt1d: bRow.lt1d || 0,
        d1to3: bRow.d1to3 || 0,
        d3to7: bRow.d3to7 || 0,
        d7to30: bRow.d7to30 || 0,
        gte30d: bRow.gte30d || 0,
        total: bRow.total || 0,
      },
      byQueue: ((byQueue as any).rows || byQueue) as any[],
      byPriority: ((byPriority as any).rows || byPriority) as any[],
    };
  }

  async getAgentPerformanceDashboard(tenantId: string | null, windowDays: number): Promise<any> {
    const days = Math.max(1, Math.min(Math.floor(windowDays || 30), 365));
    const tenantCond = tenantId ? sql`t.tenant_id = ${tenantId}` : sql`1=1`;
    const windowExpr = sql.raw(`interval '${days} days'`);
    const rows = await db.execute(sql`
      SELECT
        u.id AS "userId",
        u.email,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        COUNT(*)::int AS assigned,
        SUM(CASE WHEN t.status IN ('resolved','closed') AND COALESCE(t.resolved_at, t.closed_at) >= now() - ${windowExpr} THEN 1 ELSE 0 END)::int AS "resolvedInWindow",
        SUM(CASE WHEN t.status NOT IN ('resolved','closed','cancelled') THEN 1 ELSE 0 END)::int AS "openNow",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/60) FILTER (WHERE t.first_response_at IS NOT NULL)::float AS "medianFrMin",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, t.closed_at) - t.created_at))/60) FILTER (WHERE COALESCE(t.resolved_at, t.closed_at) IS NOT NULL)::float AS "medianResMin",
        AVG(t.csat_score) FILTER (WHERE t.csat_score IS NOT NULL)::float AS "csatAvg",
        COUNT(t.csat_score) FILTER (WHERE t.csat_score IS NOT NULL)::int AS "csatCount"
      FROM support_tickets t
      JOIN users u ON u.id = t.assigned_to
      WHERE ${tenantCond} AND t.created_at >= now() - ${windowExpr}
      GROUP BY u.id, u.email, u.first_name, u.last_name
      ORDER BY "resolvedInWindow" DESC, assigned DESC
      LIMIT 100
    `);
    return {
      windowDays: days,
      agents: ((rows as any).rows || rows) as any[],
    };
  }

  // ==================== Agent Card Health ====================
  async saveAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck> {
    const [created] = await db.insert(agentCardHealthChecks).values(result).returning();
    return created;
  }

  async addAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck> {
    return this.saveAgentCardHealthCheck(result);
  }

  async getAgentCardHealthChecks(limit: number = 50): Promise<AgentCardHealthCheck[]> {
    return db.select()
      .from(agentCardHealthChecks)
      .orderBy(desc(agentCardHealthChecks.checkedAt))
      .limit(limit);
  }

  async pruneAgentCardHealthHistory(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(agentCardHealthChecks)
      .where(lte(agentCardHealthChecks.checkedAt, cutoff))
      .returning({ id: agentCardHealthChecks.id });
    return result.length;
  }

  // ==================== Scheduled Job Runs ====================
  async createScheduledJobRun(run: Partial<InsertScheduledJobRun>): Promise<ScheduledJobRun> {
    if (!run.jobType) throw new Error("createScheduledJobRun requires jobType");
    if (!run.status) throw new Error("createScheduledJobRun requires status");
    if (!run.triggeredBy) throw new Error("createScheduledJobRun requires triggeredBy");
    const [created] = await db.insert(scheduledJobRuns).values({
      tenantId: run.tenantId ?? null,
      jobType: run.jobType,
      status: run.status,
      triggeredBy: run.triggeredBy,
      triggeredByUserId: run.triggeredByUserId ?? null,
      resultSummary: (run.resultSummary as any) ?? null,
      errorMessage: run.errorMessage ?? null,
      completedAt: run.completedAt ?? null,
    }).returning();
    return created;
  }

  async updateScheduledJobRun(id: string, updates: Partial<ScheduledJobRun>): Promise<ScheduledJobRun> {
    const patch: Record<string, unknown> = {};
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.completedAt !== undefined) patch.completedAt = updates.completedAt;
    if (updates.resultSummary !== undefined) patch.resultSummary = updates.resultSummary as any;
    if (updates.errorMessage !== undefined) patch.errorMessage = updates.errorMessage;
    const [updated] = await db.update(scheduledJobRuns)
      .set(patch as any)
      .where(eq(scheduledJobRuns.id, id))
      .returning();
    return updated;
  }

  async getLastScheduledJobRun(jobType: string): Promise<ScheduledJobRun | undefined> {
    const [row] = await db.select().from(scheduledJobRuns)
      .where(eq(scheduledJobRuns.jobType, jobType))
      .orderBy(desc(scheduledJobRuns.startedAt))
      .limit(1);
    return row;
  }

  async getLastSuccessfulScheduledJobRun(jobType: string): Promise<ScheduledJobRun | undefined> {
    const [row] = await db.select().from(scheduledJobRuns)
      .where(and(eq(scheduledJobRuns.jobType, jobType), eq(scheduledJobRuns.status, 'completed')))
      .orderBy(desc(scheduledJobRuns.startedAt))
      .limit(1);
    return row;
  }
}

export const storage: IStorage = new DbStorage();
