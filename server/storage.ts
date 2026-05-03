import {
  users, tenants, blockedDomains, systemSettings,
  groundingDocuments,
  supportQueues, supportSlaPolicies, supportKbArticles, supportAppIntegrationKeys,
  supportTickets, supportTicketReplies, supportTicketPlannerSync,
  supportTicketWatchers, supportTicketActivity,
  agentCardHealthChecks,
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type BlockedDomain, type InsertBlockedDomain,
  type SystemSetting, type InsertSystemSetting,
  type GroundingDocument, type InsertGroundingDocument,
  type SupportQueue, type InsertSupportQueue,
  type SupportSlaPolicy, type InsertSupportSlaPolicy,
  type SupportKbArticle, type InsertSupportKbArticle,
  type SupportAppIntegrationKey, type InsertSupportAppIntegrationKey,
  type SupportTicket, type InsertSupportTicket,
  type SupportTicketReply, type InsertSupportTicketReply,
  type SupportTicketPlannerSync, type InsertSupportTicketPlannerSync,
  type SupportTicketWatcher, type InsertSupportTicketWatcher,
  type SupportTicketActivity, type InsertSupportTicketActivity,
  type AgentCardHealthCheck, type InsertAgentCardHealthCheck,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, ilike, isNotNull, inArray, lte, type SQL } from "drizzle-orm";

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
  getAllSupportTickets(filters?: { status?: string | string[]; priority?: string; category?: string; tenantId?: string }): Promise<SupportTicket[]>;
  getSupportTicketById(id: string): Promise<SupportTicket | undefined>;
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

  // Agent Card Health
  saveAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck>;
  addAgentCardHealthCheck(result: InsertAgentCardHealthCheck): Promise<AgentCardHealthCheck>;
  getAgentCardHealthChecks(limit?: number): Promise<AgentCardHealthCheck[]>;
  pruneAgentCardHealthHistory(olderThanDays: number): Promise<number>;
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

  async getAllSupportTickets(filters?: { status?: string | string[]; priority?: string; category?: string; tenantId?: string }): Promise<SupportTicket[]> {
    const conds: SQL[] = [];
    if (filters?.status) {
      if (Array.isArray(filters.status)) conds.push(inArray(supportTickets.status, filters.status));
      else conds.push(eq(supportTickets.status, filters.status));
    }
    if (filters?.priority) conds.push(eq(supportTickets.priority, filters.priority));
    if (filters?.category) conds.push(eq(supportTickets.category, filters.category));
    if (filters?.tenantId) conds.push(eq(supportTickets.tenantId, filters.tenantId));
    const q = conds.length > 0
      ? db.select().from(supportTickets).where(and(...conds))
      : db.select().from(supportTickets);
    return q.orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketById(id: string): Promise<SupportTicket | undefined> {
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return t;
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
      applicationSource: ticket.applicationSource ?? 'Constellation',
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
}

export const storage: IStorage = new DbStorage();
