/**
 * Microsoft Graph mail subscription pipeline for inbound support email.
 *
 * Wires a Graph change-notification subscription onto a tenant's support
 * mailbox (e.g. Constellation@synozur.com). When Graph fires a notification,
 * we fetch the message + attachments and POST them into the existing
 * /api/support/email-inbound endpoint (with a valid HMAC signature) so all
 * inbound paths share the same routing/threading logic.
 *
 * Subscription state is persisted to support_email_subscriptions so it
 * survives process restarts. On boot, rehydrate() reattaches the renewer.
 */
import crypto from "crypto";
import type { Request, Response } from "express";
import type { SupportEmailSubscription } from "@shared/schema";
import { supportEmailStorage } from "../storage/support-email-types";
import { clientCredentialsMsalInstance, clientCredentialsRequest, getClientCredentialsMsalForTenant } from "../auth/entra-config.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let renewTimer: NodeJS.Timeout | null = null;
let rehydrated = false;

// Minimal Graph API response shapes we rely on. Kept narrow on purpose to
// avoid pulling the full @microsoft/microsoft-graph-types dependency.
interface GraphSubscription {
  id: string;
  expirationDateTime: string;
}
interface GraphEmailRecipient {
  emailAddress?: { address?: string | null; name?: string | null } | null;
}
interface GraphHeader { name?: string | null; value?: string | null }
interface GraphMessage {
  id: string;
  internetMessageId?: string | null;
  internetMessageHeaders?: GraphHeader[] | null;
  subject?: string | null;
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
  toRecipients?: GraphEmailRecipient[] | null;
  ccRecipients?: GraphEmailRecipient[] | null;
  body?: { contentType?: string; content?: string } | null;
  bodyPreview?: string | null;
  hasAttachments?: boolean;
}
interface GraphFileAttachment {
  "@odata.type"?: string;
  name?: string | null;
  contentType?: string | null;
  contentBytes?: string | null;
  size?: number | null;
}
interface GraphCollection<T> { value?: T[] }
interface GraphChangeNotification {
  subscriptionId: string;
  clientState?: string;
  resource?: string;
  resourceData?: { id?: string } | null;
}

async function getAppToken(azureTenantId: string): Promise<string> {
  const msal = azureTenantId
    ? getClientCredentialsMsalForTenant(azureTenantId)
    : clientCredentialsMsalInstance;
  if (!msal) throw new Error("Graph client credentials are not configured");
  const result = await msal.acquireTokenByClientCredential(clientCredentialsRequest);
  if (!result?.accessToken) throw new Error("Failed to acquire Graph token");
  return result.accessToken;
}

async function graphFetch<T = unknown>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph ${res.status}: ${body}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  azureTenantId: string;
  mailbox: string;            // e.g. Constellation@synozur.com
  notificationUrl: string;    // public URL pointing at /api/support/graph/notifications
  lifetimeMinutes?: number;   // capped at 4230 by Graph for mail; default 60
}

/** Provision a new Graph subscription on a mailbox's inbox. */
export async function createMailSubscription(input: CreateSubscriptionInput): Promise<SupportEmailSubscription> {
  const token = await getAppToken(input.azureTenantId);
  const lifetime = Math.min(input.lifetimeMinutes ?? 60, 4230);
  const clientState = crypto.randomBytes(24).toString("hex");
  const body = {
    changeType: "created",
    notificationUrl: input.notificationUrl,
    resource: `users/${encodeURIComponent(input.mailbox)}/mailFolders('inbox')/messages`,
    expirationDateTime: new Date(Date.now() + lifetime * 60_000).toISOString(),
    clientState,
  };
  const created = await graphFetch<GraphSubscription>(token, `${GRAPH_BASE}/subscriptions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const persisted = await supportEmailStorage.upsertSupportEmailSubscription({
    id: created.id,
    tenantId: input.tenantId,
    azureTenantId: input.azureTenantId,
    mailbox: input.mailbox,
    clientState,
    notificationUrl: input.notificationUrl,
    expiresAt: new Date(created.expirationDateTime),
  });
  scheduleRenewal();
  return persisted;
}

export async function renewSubscription(id: string, lifetimeMinutes = 60): Promise<void> {
  const sub = await supportEmailStorage.getSupportEmailSubscription(id);
  if (!sub) return;
  const token = await getAppToken(sub.azureTenantId);
  const newExp = new Date(Date.now() + Math.min(lifetimeMinutes, 4230) * 60_000);
  await graphFetch<GraphSubscription>(token, `${GRAPH_BASE}/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ expirationDateTime: newExp.toISOString() }),
  });
  await supportEmailStorage.updateSupportEmailSubscriptionExpiry(id, newExp);
}

export async function deleteSubscription(id: string): Promise<void> {
  const sub = await supportEmailStorage.getSupportEmailSubscription(id);
  if (sub) {
    try {
      const token = await getAppToken(sub.azureTenantId);
      await graphFetch<null>(token, `${GRAPH_BASE}/subscriptions/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(`[GRAPH-SUB] remote delete failed (continuing local cleanup):`, err);
    }
  }
  await supportEmailStorage.deleteSupportEmailSubscription(id);
}

export async function listSubscriptions(tenantId?: string): Promise<SupportEmailSubscription[]> {
  return supportEmailStorage.listSupportEmailSubscriptions(tenantId);
}

function scheduleRenewal() {
  if (renewTimer) return;
  renewTimer = setInterval(async () => {
    try {
      const all = await supportEmailStorage.listSupportEmailSubscriptions();
      const now = Date.now();
      for (const sub of all) {
        const expMs = new Date(sub.expiresAt).getTime();
        if (expMs - now < 15 * 60_000) {
          try { await renewSubscription(sub.id, 60); }
          catch (err) { console.error(`[GRAPH-SUB] renew failed for ${sub.id}:`, err); }
        }
      }
    } catch (err) {
      console.error("[GRAPH-SUB] renewal sweep failed:", err);
    }
  }, 5 * 60_000);
  (renewTimer as NodeJS.Timeout & { unref?: () => void }).unref?.();
}

/** Reattach the renewer to subscriptions persisted before the last restart. */
export async function rehydrate(): Promise<void> {
  if (rehydrated) return;
  rehydrated = true;
  try {
    const all = await supportEmailStorage.listSupportEmailSubscriptions();
    if (all.length) {
      console.log(`[GRAPH-SUB] rehydrated ${all.length} mailbox subscription(s)`);
      scheduleRenewal();
    }
  } catch (err) {
    console.error("[GRAPH-SUB] rehydrate failed:", err);
  }
}

/**
 * Fetch a Graph message + attachments and POST them to the existing
 * /api/support/email-inbound webhook. Done this way so all inbound entry points
 * share routing, bounce filtering, threading, and SLA logic.
 */
export async function ingestMessage(sub: SupportEmailSubscription, messageId: string, inboundUrl: string, inboundSecret: string) {
  const token = await getAppToken(sub.azureTenantId);
  const msg = await graphFetch<GraphMessage>(token, `${GRAPH_BASE}/users/${encodeURIComponent(sub.mailbox)}/messages/${messageId}?$select=id,internetMessageId,internetMessageHeaders,subject,from,toRecipients,ccRecipients,body,bodyPreview,hasAttachments`);
  const headers: Record<string, string> = {};
  for (const h of (msg.internetMessageHeaders || [])) {
    if (h?.name && h?.value != null) headers[String(h.name).toLowerCase()] = String(h.value);
  }

  const attachments: Array<{ fileName: string; contentType: string; contentBase64: string; size: number }> = [];
  if (msg.hasAttachments) {
    const list = await graphFetch<GraphCollection<GraphFileAttachment>>(token, `${GRAPH_BASE}/users/${encodeURIComponent(sub.mailbox)}/messages/${messageId}/attachments?$top=20`);
    for (const a of (list.value || [])) {
      if (a["@odata.type"] === "#microsoft.graph.fileAttachment" && a.contentBytes) {
        attachments.push({
          fileName: a.name || "attachment",
          contentType: a.contentType || "application/octet-stream",
          contentBase64: a.contentBytes,
          size: typeof a.size === "number" ? a.size : 0,
        });
      }
    }
  }

  const recipientAddress = (r: GraphEmailRecipient): string | null => r.emailAddress?.address ?? null;
  const payload = {
    from: { email: msg.from?.emailAddress?.address || "", name: msg.from?.emailAddress?.name ?? undefined },
    to: (msg.toRecipients || []).map(recipientAddress).filter((x): x is string => !!x),
    cc: (msg.ccRecipients || []).map(recipientAddress).filter((x): x is string => !!x),
    subject: msg.subject || "(no subject)",
    text: msg.body?.contentType === "text" ? (msg.body.content || "") : (msg.bodyPreview || ""),
    html: msg.body?.contentType === "html" ? msg.body.content : undefined,
    messageId: msg.internetMessageId || null,
    inReplyTo: headers["in-reply-to"] || null,
    references: headers["references"] || null,
    headers,
    attachments,
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", inboundSecret).update(raw).digest("hex");
  const res = await fetch(inboundUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Inbound-Signature": sig,
      "X-Tenant-Id": sub.tenantId,
    },
    body: raw,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`inbound webhook ${res.status}: ${text}`);
  }
}

/**
 * Express handler for Graph notifications. Handles validationToken handshake
 * and dispatches each notification to ingestMessage().
 */
export async function handleGraphNotification(req: Request, res: Response): Promise<void> {
  // Handshake: Graph appends ?validationToken=... and expects it echoed as text.
  const validationToken = req.query?.validationToken;
  if (typeof validationToken === "string") {
    res.status(200).type("text/plain").send(validationToken);
    return;
  }

  // Always 202 quickly; do work async but keep error logs.
  res.status(202).json({ ok: true });

  const inboundSecret = process.env.SUPPORT_INBOUND_EMAIL_SECRET;
  if (!inboundSecret) {
    console.error("[GRAPH-SUB] SUPPORT_INBOUND_EMAIL_SECRET not set; cannot dispatch");
    return;
  }
  const APP_URL = process.env.APP_PUBLIC_URL || `https://${req.get("host") || ""}`;
  const inboundUrl = `${APP_URL}/api/support/email-inbound`;

  const body = req.body as { value?: GraphChangeNotification[] } | undefined;
  const notes: GraphChangeNotification[] = body?.value || [];
  for (const n of notes) {
    try {
      const sub = await supportEmailStorage.getSupportEmailSubscription(n.subscriptionId);
      if (!sub) { console.warn(`[GRAPH-SUB] unknown subscriptionId ${n.subscriptionId}`); continue; }
      // Authenticate every notification: clientState is the shared secret
      // we set when creating the subscription. A missing or mismatched value
      // means the request did not come from Graph (or is replayed from a
      // different subscription). Reject in both cases.
      if (!n.clientState || n.clientState !== sub.clientState) {
        console.warn(`[GRAPH-SUB] clientState rejected for ${n.subscriptionId}`); continue;
      }
      const messageId = n.resourceData?.id || (typeof n.resource === "string" ? n.resource.split("/").pop() : null);
      if (!messageId) continue;
      await ingestMessage(sub, messageId, inboundUrl, inboundSecret);
    } catch (err) {
      console.error("[GRAPH-SUB] notification dispatch failed:", err);
    }
  }
}
