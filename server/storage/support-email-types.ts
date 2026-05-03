import type {
  SupportTicketReply,
  InsertSupportTicketReply,
  SupportTicketWatcher,
  SupportTicketActivity,
  InsertSupportTicketActivity,
  SupportTicketAttachment,
  InsertSupportTicketAttachment,
  SupportEmailSubscription,
  InsertSupportEmailSubscription,
} from "@shared/schema";
import { storage } from "./index";

export interface ISupportEmailStorage {
  getSupportTicketRepliesWithMessageIds(ticketId: string): Promise<SupportTicketReply[]>;
  getSupportTicketReplyByMessageId(messageId: string): Promise<SupportTicketReply | undefined>;
  updateSupportTicketReply(id: string, updates: Partial<InsertSupportTicketReply>): Promise<SupportTicketReply>;
  getSupportTicketWatchers(ticketId: string): Promise<SupportTicketWatcher[]>;
  logSupportTicketActivity(activity: InsertSupportTicketActivity): Promise<SupportTicketActivity>;
  createSupportTicketAttachment(attachment: InsertSupportTicketAttachment): Promise<SupportTicketAttachment>;
  upsertSupportEmailSubscription(sub: InsertSupportEmailSubscription): Promise<SupportEmailSubscription>;
  updateSupportEmailSubscriptionExpiry(id: string, expiresAt: Date): Promise<void>;
  deleteSupportEmailSubscription(id: string): Promise<void>;
  getSupportEmailSubscription(id: string): Promise<SupportEmailSubscription | undefined>;
  listSupportEmailSubscriptions(tenantId?: string): Promise<SupportEmailSubscription[]>;
}

/**
 * Typed accessor for the support email/threading storage methods. The
 * underlying DatabaseStorage implements all of these (see server/storage/admin.ts);
 * this view exposes them with strong types so callers can rely on compile-time
 * checks instead of `as any` and optional chaining.
 */
export const supportEmailStorage = storage as unknown as ISupportEmailStorage;
