import { getUncachableSendGridClient } from "./services/sendgrid-client";
import type { SupportTicket, SupportTicketReply } from "@shared/schema";
import crypto from "crypto";

const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';

const SUPPORT_NOTIFICATION_EMAIL = "Constellation@synozur.com";

// Domain used for the per-ticket Reply-To address. The MX for this domain
// must route to whatever delivers messages into /api/support/email-inbound
// (e.g. Microsoft Graph subscription on Constellation@synozur.com).
export const SUPPORT_REPLY_DOMAIN = process.env.SUPPORT_REPLY_DOMAIN || "support.synozur.com";

function buildPortalUrl(ticket: SupportTicket): string {
  if (ticket.portalToken) return `${APP_URL}/portal/ticket/${ticket.portalToken}`;
  return `${APP_URL}/support`;
}

// ===========================================================================
// Threading helpers (RFC 5322 / 2822)
// ===========================================================================

/** Generate a deterministic-but-unique Message-ID for an outbound reply. */
export function buildReplyMessageId(ticketId: string, replyId?: string, replyDomain?: string): string {
  const rand = crypto.randomBytes(8).toString("hex");
  const local = `${ticketId.slice(0, 12)}.${replyId?.slice(0, 12) || rand}.${Date.now()}`;
  return `<${local}@${replyDomain || SUPPORT_REPLY_DOMAIN}>`;
}

/** Build the Reply-To address that loops inbound replies back to a specific ticket. */
export function buildReplyToAddress(ticket: SupportTicket, replyDomain?: string): string | null {
  if (!ticket.portalToken) return null;
  return `ticket+${ticket.portalToken}@${replyDomain || SUPPORT_REPLY_DOMAIN}`;
}

/** Extract a portal token from any address that looks like ticket+<token>@... */
export function extractTokenFromAddress(addr: string | undefined | null): string | null {
  if (!addr) return null;
  // Pull every email-shaped token out of the string and look for ticket+<token>
  const re = /ticket\+([a-f0-9]{16,128})@/gi;
  const m = re.exec(addr);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Walk a list of `To`/`Cc`/header values (raw strings or arrays) and return the
 * first portal token found in a `ticket+<token>@…` address.
 */
export function findReplyToToken(...values: Array<string | string[] | null | undefined>): string | null {
  for (const v of values) {
    if (!v) continue;
    const arr = Array.isArray(v) ? v : [v];
    for (const s of arr) {
      const t = extractTokenFromAddress(s);
      if (t) return t;
    }
  }
  return null;
}

/** Normalize an inbound Message-ID-shaped string. Returns null if it doesn't look like one. */
export function normalizeMessageId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Ensure angle brackets
  const wrapped = trimmed.startsWith("<") ? trimmed : `<${trimmed}`;
  const closed = wrapped.endsWith(">") ? wrapped : `${wrapped}>`;
  // Basic sanity: must contain @ and not be huge
  if (!closed.includes("@") || closed.length > 998) return null;
  return closed;
}

/**
 * Detect bounces and auto-replies (out-of-office, vacation responders, etc.)
 * so we don't open new tickets or append noise. Conservative: when in doubt,
 * skip rather than create.
 */
export function isBounceOrAutoReply(input: {
  headers?: Record<string, string | string[] | undefined> | null;
  fromEmail?: string | null;
  subject?: string | null;
}): { skip: boolean; reason?: string } {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers || {})) {
    if (v == null) continue;
    headers[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : String(v);
  }
  const autoSub = headers["auto-submitted"];
  if (autoSub && autoSub.toLowerCase() !== "no") {
    return { skip: true, reason: `auto-submitted: ${autoSub}` };
  }
  if (headers["x-autoreply"] || headers["x-autorespond"] || headers["x-auto-response-suppress"]) {
    return { skip: true, reason: "auto-reply header present" };
  }
  const precedence = headers["precedence"];
  if (precedence && /^(auto_reply|bulk|junk|list)$/i.test(precedence.trim())) {
    return { skip: true, reason: `precedence: ${precedence}` };
  }
  if (headers["x-failed-recipients"] || headers["x-postmaster-msgtype"]) {
    return { skip: true, reason: "bounce headers present" };
  }
  const from = (input.fromEmail || "").toLowerCase();
  if (from) {
    if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[s-]|mailerdaemon)/i.test(from.split("@")[0] || "")) {
      return { skip: true, reason: `bounce/no-reply sender: ${from}` };
    }
  }
  const subject = (input.subject || "").toLowerCase();
  if (subject) {
    if (/(undeliverable|delivery (status|failure)|mail delivery (failed|subsystem)|returned mail|out of office|automatic reply|auto[- ]?reply|on vacation)/i.test(subject)) {
      return { skip: true, reason: `bounce/auto-reply subject: ${input.subject}` };
    }
  }
  return { skip: false };
}

export async function sendExternalTicketConfirmation(
  ticket: SupportTicket,
  requester: { email: string; name?: string },
  portalUrl: string,
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const name = requester.name || "there";
  const msg = {
    to: requester.email,
    from: fromEmail,
    subject: `[Synozur Support] Ticket #${ticket.ticketNumber} received`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1d4ed8; color: #fff; padding: 24px;">
          <h2 style="margin:0;">Support ticket #${ticket.ticketNumber}</h2>
          <div style="opacity:.85; font-size:13px;">${ticket.applicationSource}</div>
        </div>
        <div style="padding: 20px; background: #fff;">
          <p>Hi ${name},</p>
          <p>We've received your request. Subject: <strong>${ticket.subject}</strong></p>
          <p>You can view the status, add comments, and provide feedback at any time:</p>
          <p><a href="${portalUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;">Open your ticket portal</a></p>
          <p style="color:#666;font-size:12px;">This link is private — keep it like a password. You'll get more email when our team responds.</p>
        </div>
      </div>
    `,
  };
  await client.send(msg);
}

export async function sendSupportTicketNotification(
  ticket: SupportTicket,
  user: { email: string; firstName?: string | null; lastName?: string | null }
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

  const msg = {
    to: SUPPORT_NOTIFICATION_EMAIL,
    from: fromEmail,
    subject: `[Constellation Support] New ${ticket.priority} ${ticket.category.replace('_', ' ')} - Ticket #${ticket.ticketNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="padding: 30px 40px; background: ${ticket.priority === 'high' ? '#dc2626' : ticket.priority === 'medium' ? '#d97706' : '#2563eb'};">
                      <h1 style="margin: 0; font-size: 20px; color: #ffffff;">New Support Ticket #${ticket.ticketNumber}</h1>
                      <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${(ticket.priority || 'medium').toUpperCase()} priority ${ticket.category.replace('_', ' ')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">Application</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">Constellation</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">User</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${userName} (${user.email})</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888;">Subject</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0;">${ticket.subject}</td></tr>
                      </table>
                      <div style="padding: 16px; background: #111; border-radius: 8px; margin: 0 0 20px;">
                        <p style="margin: 0; font-size: 13px; color: #ccc; white-space: pre-wrap;">${ticket.description}</p>
                      </div>
                      <a href="${APP_URL}/support" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">View in Constellation</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  await client.send(msg);
}

export async function sendSlaBreachEscalation(
  ticket: SupportTicket,
  recipients: string[],
  details: {
    breachType: 'first_response' | 'resolution';
    queueName?: string | null;
    requesterEmail?: string | null;
    overdueMinutes: number;
    priorityBumpedTo?: string | null;
  },
) {
  if (recipients.length === 0) return;
  const { client, fromEmail } = await getUncachableSendGridClient();
  const [primary, ...rest] = recipients;
  const bcc = rest.length > 0 ? rest : undefined;
  const breachLabel = details.breachType === 'first_response' ? 'First Response' : 'Resolution';
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60_000));
  const ageStr = ageMinutes >= 60 ? `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m` : `${ageMinutes}m`;
  const overdueStr = details.overdueMinutes >= 60
    ? `${Math.floor(details.overdueMinutes / 60)}h ${details.overdueMinutes % 60}m`
    : `${details.overdueMinutes}m`;
  const deepLink = `${APP_URL}/support?ticketId=${ticket.id}`;
  const bumpRow = details.priorityBumpedTo
    ? `<tr><td style="padding:6px 12px;font-size:13px;color:#888;">Priority</td><td style="padding:6px 12px;font-size:13px;color:#dc2626;font-weight:600;">Bumped to ${details.priorityBumpedTo.toUpperCase()}</td></tr>`
    : `<tr><td style="padding:6px 12px;font-size:13px;color:#888;">Priority</td><td style="padding:6px 12px;font-size:13px;color:#333;">${(ticket.priority || 'medium').toUpperCase()}</td></tr>`;
  const msg = {
    to: primary,
    bcc,
    from: fromEmail,
    subject: `[SLA BREACH] ${breachLabel} overdue – Ticket #${ticket.ticketNumber}: ${ticket.subject}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background:#dc2626;color:#fff;padding:20px;">
          <h2 style="margin:0;">SLA Breach: ${breachLabel} overdue</h2>
          <div style="opacity:.9;font-size:13px;margin-top:4px;">Ticket #${ticket.ticketNumber} · ${overdueStr} past due</div>
        </div>
        <div style="padding:20px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="padding:6px 12px;font-size:13px;color:#888;border-bottom:1px solid #eee;">Subject</td><td style="padding:6px 12px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${ticket.subject}</td></tr>
            <tr><td style="padding:6px 12px;font-size:13px;color:#888;border-bottom:1px solid #eee;">Requester</td><td style="padding:6px 12px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${details.requesterEmail || '—'}</td></tr>
            <tr><td style="padding:6px 12px;font-size:13px;color:#888;border-bottom:1px solid #eee;">Queue</td><td style="padding:6px 12px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${details.queueName || '—'}</td></tr>
            <tr><td style="padding:6px 12px;font-size:13px;color:#888;border-bottom:1px solid #eee;">Age</td><td style="padding:6px 12px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${ageStr}</td></tr>
            ${bumpRow}
          </table>
          <a href="${deepLink}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Open in agent console</a>
        </div>
      </div>
    `,
  };
  await client.send(msg);
}

export async function sendTicketConfirmationToSubmitter(
  ticket: SupportTicket,
  user: { email: string; firstName?: string | null; lastName?: string | null }
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';

  const msg = {
    to: user.email,
    from: fromEmail,
    subject: `Your support ticket #${ticket.ticketNumber} has been received`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; color: #333;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 30px 40px; background: #2563eb;">
                      <h1 style="margin: 0; font-size: 20px; color: #ffffff;">Support Ticket Received</h1>
                      <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">Ticket #${ticket.ticketNumber}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 16px; font-size: 14px; color: #333;">Hi ${userName},</p>
                      <p style="margin: 0 0 16px; font-size: 14px; color: #333;">Thank you for reaching out. We've received your support ticket and our team will review it shortly.</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px; background: #f9fafb; border-radius: 8px;">
                        <tr><td style="padding: 10px 14px; font-size: 13px; color: #666; border-bottom: 1px solid #e5e7eb;">Ticket #</td><td style="padding: 10px 14px; font-size: 13px; color: #333; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${ticket.ticketNumber}</td></tr>
                        <tr><td style="padding: 10px 14px; font-size: 13px; color: #666; border-bottom: 1px solid #e5e7eb;">Subject</td><td style="padding: 10px 14px; font-size: 13px; color: #333; border-bottom: 1px solid #e5e7eb;">${ticket.subject}</td></tr>
                        <tr><td style="padding: 10px 14px; font-size: 13px; color: #666; border-bottom: 1px solid #e5e7eb;">Category</td><td style="padding: 10px 14px; font-size: 13px; color: #333; border-bottom: 1px solid #e5e7eb;">${ticket.category.replace('_', ' ')}</td></tr>
                        <tr><td style="padding: 10px 14px; font-size: 13px; color: #666;">Priority</td><td style="padding: 10px 14px; font-size: 13px; color: #333;">${(ticket.priority || 'medium').charAt(0).toUpperCase() + (ticket.priority || 'medium').slice(1)}</td></tr>
                      </table>
                      <p style="margin: 0 0 20px; font-size: 14px; color: #333;">You can track your ticket status and add updates anytime:</p>
                      <a href="${buildPortalUrl(ticket)}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">View Your Ticket</a>
                      <p style="margin: 20px 0 0; font-size: 13px; color: #888;">You'll receive another email when your ticket is resolved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  await client.send(msg);
}

// ===========================================================================
// Outbound staff reply pipeline
// ===========================================================================

export interface StaffReplyEmailInput {
  ticket: SupportTicket;
  reply: SupportTicketReply;                  // freshly persisted reply
  staffName: string;                          // sender display name
  requesterEmail: string;                     // primary To: address
  requesterName?: string | null;
  ccEmails?: string[];                        // watcher emails
  priorMessageIds?: Array<string | null | undefined>; // for References chain
  tenantName?: string | null;
  // Per-tenant sender identity. fromEmail overrides the SendGrid default; replyDomain
  // overrides SUPPORT_REPLY_DOMAIN so each tenant's outbound mail comes from its own
  // mailbox and per-ticket Reply-To loops back through that tenant's MX.
  fromEmail?: string | null;
  fromName?: string | null;
  replyDomain?: string | null;
}

/**
 * Send the requester an email for a non-internal staff reply, with proper
 * threading headers and a per-ticket Reply-To. Returns the Message-ID we used
 * so the caller can persist it on the reply for future threading lookups.
 */
export async function sendStaffReplyEmail(input: StaffReplyEmailInput): Promise<string | null> {
  if (!input.requesterEmail) return null;
  const { client, fromEmail: defaultFromEmail } = await getUncachableSendGridClient();
  const replyDomain = input.replyDomain || SUPPORT_REPLY_DOMAIN;
  const fromEmail = input.fromEmail || defaultFromEmail;
  const messageId = buildReplyMessageId(input.ticket.id, input.reply.id, replyDomain);
  const replyTo = buildReplyToAddress(input.ticket, replyDomain);

  // Build References chain: dedupe + cap to last 10 like most clients do.
  const refs: string[] = [];
  for (const m of (input.priorMessageIds || [])) {
    const n = normalizeMessageId(m);
    if (n && !refs.includes(n)) refs.push(n);
  }
  const references = refs.slice(-10).join(" ");
  const inReplyTo = refs.length ? refs[refs.length - 1] : null;

  const subjectPrefix = /\[#\d+\]/.test(input.ticket.subject) ? "" : `[#${input.ticket.ticketNumber}] `;
  const subject = `Re: ${subjectPrefix}${input.ticket.subject}`;
  const portalUrl = buildPortalUrl(input.ticket);
  const fromHeaderName = input.fromName || (input.tenantName ? `${input.tenantName} Support` : "Synozur Support");
  const safeBody = input.reply.message.replace(/\r\n/g, "\n");
  const htmlBody = safeBody
    .split("\n")
    .map(line => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br>");

  const headers: Record<string, string> = { "Message-ID": messageId };
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
  if (references) headers["References"] = references;

  interface OutboundMessage {
    to: string;
    from: { email: string; name: string };
    subject: string;
    headers: Record<string, string>;
    html: string;
    text: string;
    replyTo?: string;
    cc?: string[];
  }

  const msg: OutboundMessage = {
    to: input.requesterEmail,
    from: { email: fromEmail, name: fromHeaderName },
    subject,
    headers,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="padding: 16px 20px; background: #1d4ed8; color: #fff;">
          <strong>Ticket #${input.ticket.ticketNumber}</strong>
          <span style="opacity:.85;"> &middot; ${input.ticket.subject}</span>
        </div>
        <div style="padding: 20px; background: #fff; color: #1f2937; line-height:1.5; font-size:14px;">
          <div style="margin-bottom:8px;color:#374151;"><strong>${input.staffName}</strong> replied:</div>
          <div style="white-space:pre-wrap;">${htmlBody}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <div style="font-size:12px;color:#6b7280;">
            Reply directly to this email to update your ticket, or
            <a href="${portalUrl}" style="color:#1d4ed8;">open the ticket portal</a>.
          </div>
        </div>
      </div>
    `,
    text: `${input.staffName} replied:\n\n${safeBody}\n\nReply to this email to update ticket #${input.ticket.ticketNumber}, or visit ${portalUrl}`,
  };
  if (replyTo) msg.replyTo = replyTo;
  if (input.ccEmails && input.ccEmails.length) msg.cc = input.ccEmails;

  await client.send(msg);
  return messageId;
}

