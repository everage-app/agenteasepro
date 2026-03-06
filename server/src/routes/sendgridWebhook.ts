import type { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../services/emailService';
import { extractEmailAddress, extractReplyTokenFromAddressList, verifyContactReplyToken } from '../services/contactReplyToken';

function getPublicKeyPem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('-----BEGIN')) return trimmed;
  // Assume base64 without PEM header/footer.
  return `-----BEGIN PUBLIC KEY-----\n${trimmed}\n-----END PUBLIC KEY-----`;
}

function verifySendGridEventWebhook(params: {
  rawBody: Buffer;
  signature: string | undefined;
  timestamp: string | undefined;
}): boolean {
  const publicKeyRaw = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyRaw) return false;
  if (!params.signature || !params.timestamp) return false;

  const publicKeyPem = getPublicKeyPem(publicKeyRaw);
  const signedPayload = Buffer.concat([Buffer.from(params.timestamp, 'utf8'), params.rawBody]);

  try {
    const verifier = crypto.createVerify('sha256');
    verifier.update(signedPayload);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(params.signature, 'base64'));
  } catch {
    return false;
  }
}

function hasValidFallbackSecret(req: Request): boolean {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = (req.headers['x-agentease-webhook-secret'] as string | undefined) || undefined;
  const query = (req.query?.secret as string | undefined) || undefined;
  return header === secret || query === secret;
}

function safeString(v: unknown, max = 500): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function toDateFromEpochSeconds(value: unknown): Date {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return new Date();
  return new Date(n * 1000);
}

function hasValidInboundSecret(req: Request): boolean {
  const secret = process.env.SENDGRID_INBOUND_PARSE_SECRET || process.env.SENDGRID_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = (req.headers['x-agentease-webhook-secret'] as string | undefined) || undefined;
  const query = (req.query?.secret as string | undefined) || undefined;
  return header === secret || query === secret;
}

function sanitizeText(value: string | undefined, max = 8000): string {
  const v = String(value || '').trim();
  if (!v) return '';
  return v.length > max ? v.slice(0, max) : v;
}

function stripHtml(value: string | undefined): string {
  const html = String(value || '');
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeaderValue(headersRaw: string, headerName: string): string | null {
  const regex = new RegExp(`^${headerName}\\s*:\\s*(.+)$`, 'im');
  const match = headersRaw.match(regex);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

function cleanMessageId(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  return value.replace(/[<>]/g, '').trim() || null;
}

function extractEmailAddresses(raw: string | null | undefined): string[] {
  const value = String(raw || '').trim();
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

async function getContactForInbound(params: {
  agentId: string;
  contactType: 'lead' | 'client';
  contactId: string;
}) {
  if (params.contactType === 'lead') {
    const lead = await prisma.lead.findFirst({
      where: { id: params.contactId, agentId: params.agentId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!lead) return null;
    return {
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`.trim() || 'Lead',
      email: lead.email,
      leadId: lead.id,
      clientId: null as string | null,
      contactType: 'lead' as const,
    };
  }

  const client = await prisma.client.findFirst({
    where: { id: params.contactId, agentId: params.agentId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!client) return null;

  return {
    id: client.id,
    name: `${client.firstName} ${client.lastName}`.trim() || 'Client',
    email: client.email || null,
    leadId: null as string | null,
    clientId: client.id,
    contactType: 'client' as const,
  };
}

export async function sendgridInboundParseHandler(req: Request, res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !hasValidInboundSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;

    const toRaw = String(body.to || body.envelope || '').trim();
    const fromRaw = String(body.from || '').trim();
    const subject = sanitizeText(String(body.subject || ''), 300);
    const textBody = sanitizeText(String(body.text || ''), 16000);
    const strippedTextBody = sanitizeText(String(body['stripped-text'] || body.strippedText || ''), 16000);
    const strippedHtmlBody = sanitizeText(String(body['stripped-html'] || body.strippedHtml || ''), 50000);
    const htmlBody = sanitizeText(String(body.html || ''), 50000);
    const headersRaw = String(body.headers || '');

    const token = extractReplyTokenFromAddressList(toRaw);
    const fromEmail = extractEmailAddress(fromRaw);
    let resolvedAgentId: string | null = null;
    let resolvedContactType: 'lead' | 'client' | null = null;
    let resolvedContactId: string | null = null;
    let resolutionMethod: 'token' | 'token_lookup' | 'fallback_sender' | null = null;

    if (token) {
      const decoded = verifyContactReplyToken(token);
      if (decoded) {
        resolvedAgentId = decoded.agentId;
        resolvedContactType = decoded.contactType;
        resolvedContactId = decoded.contactId;
        resolutionMethod = 'token';
      }
    }

    if (token && (!resolvedAgentId || !resolvedContactType || !resolvedContactId)) {
      const routedEvent = await prisma.internalEvent.findFirst({
        where: {
          kind: 'contact_email_sent',
          meta: {
            path: ['replyToken'],
            equals: token,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          agentId: true,
          meta: true,
        },
      });

      const routedMeta = (routedEvent?.meta || {}) as any;
      const routedType = routedMeta?.contactType === 'lead' || routedMeta?.contactType === 'client' ? routedMeta.contactType : null;
      const routedId = typeof routedMeta?.contactId === 'string' ? routedMeta.contactId : null;

      if (routedEvent?.agentId && routedType && routedId) {
        resolvedAgentId = routedEvent.agentId;
        resolvedContactType = routedType;
        resolvedContactId = routedId;
        resolutionMethod = 'token_lookup';
      }
    }

    if (!resolvedAgentId || !resolvedContactType || !resolvedContactId) {
      const toEmails = extractEmailAddresses(toRaw);
      if (fromEmail && toEmails.length > 0) {
        let fallbackAgent: { id: string; email: string; name: string } | null = null;
        for (const toEmail of toEmails) {
          fallbackAgent = await prisma.agent.findFirst({
            where: {
              email: {
                equals: toEmail,
                mode: 'insensitive',
              },
            },
            select: { id: true, email: true, name: true },
          });
          if (fallbackAgent) break;
        }

        if (fallbackAgent) {
          const [leadMatch, clientMatch] = await Promise.all([
            prisma.lead.findFirst({
              where: {
                agentId: fallbackAgent.id,
                email: {
                  equals: fromEmail,
                  mode: 'insensitive',
                },
              },
              orderBy: [{ lastContact: 'desc' }, { updatedAt: 'desc' }],
              select: { id: true, lastContact: true, updatedAt: true },
            }),
            prisma.client.findFirst({
              where: {
                agentId: fallbackAgent.id,
                email: {
                  equals: fromEmail,
                  mode: 'insensitive',
                },
              },
              orderBy: [{ lastContactAt: 'desc' }, { updatedAt: 'desc' }],
              select: { id: true, lastContactAt: true, updatedAt: true },
            }),
          ]);

          if (leadMatch || clientMatch) {
            const leadTs = leadMatch?.lastContact || leadMatch?.updatedAt || null;
            const clientTs = clientMatch?.lastContactAt || clientMatch?.updatedAt || null;
            const chooseLead = Boolean(
              leadMatch &&
                (!clientMatch || (leadTs && clientTs ? new Date(leadTs).getTime() >= new Date(clientTs).getTime() : true)),
            );

            resolvedAgentId = fallbackAgent.id;
            resolvedContactType = chooseLead ? 'lead' : 'client';
            resolvedContactId = chooseLead ? leadMatch!.id : clientMatch!.id;
            resolutionMethod = 'fallback_sender';
          }
        }
      }
    }

    if (!resolvedAgentId || !resolvedContactType || !resolvedContactId) {
      return res.json({ ok: true, ignored: token ? 'invalid_contact_token' : 'unresolved_contact' });
    }

    const [agent, contact, prefs] = await Promise.all([
      prisma.agent.findUnique({
        where: { id: resolvedAgentId },
        select: { id: true, email: true, name: true },
      }),
      getContactForInbound({
        agentId: resolvedAgentId,
        contactType: resolvedContactType,
        contactId: resolvedContactId,
      }),
      prisma.agentNotificationPrefs.findUnique({
        where: { agentId: resolvedAgentId },
        select: { deadlineEmails: true },
      }),
    ]);

    if (!agent || !contact) {
      return res.json({ ok: true, ignored: 'contact_not_found' });
    }

    const agentId = resolvedAgentId;
    const contactType = resolvedContactType;
    const contactId = resolvedContactId;

    const inboundMessageId = cleanMessageId(
      parseHeaderValue(headersRaw, 'Message-ID') ||
      parseHeaderValue(headersRaw, 'Message-Id') ||
      String(body['message-id'] || body['Message-Id'] || body['Message-ID'] || ''),
    );

    if (inboundMessageId) {
      const existing = await prisma.internalEvent.findFirst({
        where: {
          agentId,
          kind: 'contact_email_reply_received',
          meta: {
            path: ['inboundMessageId'],
            equals: inboundMessageId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        return res.json({ ok: true, deduped: true });
      }
    }

    const normalizedText = strippedTextBody || textBody || stripHtml(strippedHtmlBody || htmlBody);
    const snippet = sanitizeText(normalizedText, 280);
    const now = new Date();
    const followUpTag = `contact:${contactType}:${contactId}`;

    await prisma.$transaction(async (tx) => {
      await tx.internalEvent.create({
        data: {
          agentId,
          kind: 'contact_email_reply_received',
          path: '/api/integrations/sendgrid/inbound',
          meta: {
            contactType,
            contactId,
            contactName: contact.name,
            contactEmail: contact.email,
            fromEmail,
            subject: subject || null,
            body: normalizedText || null,
            snippet: snippet || null,
            eventType: 'INBOUND_REPLY',
            inboundMessageId,
            resolutionMethod,
          },
        },
      });

      await tx.marketingEmailEvent.create({
        data: {
          provider: 'sendgrid',
          eventType: 'INBOUND_REPLY',
          email: fromEmail,
          messageId: inboundMessageId,
          occurredAt: now,
          agentId,
          meta: {
            to: toRaw,
            from: fromRaw,
            subject: subject || null,
            custom_args: {
              agentId,
              contactType,
              contactId,
            },
          },
        },
      });

      if (contactType === 'lead' && contact.leadId) {
        await tx.leadActivity.create({
          data: {
            leadId: contact.leadId,
            activityType: 'EMAIL',
            description: subject ? `Reply received: ${subject}` : 'Reply received from contact',
            metadata: {
              source: 'contact_email_reply',
              fromEmail,
              subject: subject || null,
              inboundMessageId,
              snippet: snippet || null,
            },
          },
        });

        await tx.lead.update({
          where: { id: contact.leadId },
          data: { lastContact: now },
        });
      }

      if (contactType === 'client' && contact.clientId) {
        await tx.client.update({
          where: { id: contact.clientId },
          data: { lastContactAt: now },
        });
      }

      const existingTask = await tx.task.findFirst({
        where: {
          agentId,
          status: 'OPEN',
          createdFrom: 'SYSTEM',
          description: {
            contains: followUpTag,
          },
          createdAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24),
          },
        },
        select: { id: true },
      });

      if (!existingTask) {
        await tx.task.create({
          data: {
            agentId,
            clientId: contact.clientId || undefined,
            title: `Reply from ${contact.name}`,
            description: `${followUpTag}${subject ? ` • ${subject}` : ''}`,
            category: 'CALL',
            priority: 'HIGH',
            bucket: 'TODAY',
            dueAt: now,
            createdFrom: 'SYSTEM',
          },
        });
      }
    });

    if (prefs?.deadlineEmails !== false && agent.email) {
      const appBaseUrl = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://app.agenteasepro.com';
      const destination = `${appBaseUrl}/${contactType === 'lead' ? 'leads' : 'clients'}`;
      const safeName = contact.name || (contactType === 'lead' ? 'Lead' : 'Client');

      await sendEmail({
        to: agent.email,
        subject: `New reply from ${safeName}`,
        text: `${safeName} replied${subject ? `: ${subject}` : '.'}\n\n${snippet || '(No message preview)'}\n\nOpen ${contactType} list: ${destination}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
          <h2 style="margin:0 0 8px;">New reply from ${safeName}</h2>
          ${subject ? `<p style="margin:0 0 8px;"><strong>Subject:</strong> ${subject}</p>` : ''}
          <p style="margin:0 0 14px;"><strong>Preview:</strong> ${snippet || '(No message preview)'}</p>
          <a href="${destination}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0891b2;color:#fff;text-decoration:none;font-weight:600;">Open in AgentEase Pro</a>
        </div>`,
        categories: ['contact-email-reply-alert'],
        customArgs: {
          agentId,
          contactType,
          contactId,
        },
      });
    }

    return res.json({ ok: true, tracked: true });
  } catch (err) {
    console.error('SendGrid inbound parse failed', err);
    return res.status(500).json({ error: 'Failed to ingest inbound email' });
  }
}

export async function sendgridEventsWebhookHandler(req: Request, res: Response) {
  const rawBody = Buffer.isBuffer((req as any).body) ? ((req as any).body as Buffer) : Buffer.from('');

  const signature = req.header('x-twilio-email-event-webhook-signature') || undefined;
  const timestamp = req.header('x-twilio-email-event-webhook-timestamp') || undefined;

  const signatureOk = verifySendGridEventWebhook({ rawBody, signature, timestamp });
  const secretOk = hasValidFallbackSecret(req);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !signatureOk && !secretOk) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  let events: any[] = [];
  try {
    events = JSON.parse(rawBody.toString('utf8'));
    if (!Array.isArray(events)) events = [];
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const inserts: Array<ReturnType<typeof prisma.marketingEmailEvent.create> | ReturnType<typeof prisma.internalEvent.create>> = [];

  for (const e of events.slice(0, 5000)) {
    const customArgs = (e?.custom_args || e?.unique_args || {}) as Record<string, any>;
    const agentId = safeString(customArgs.agentId, 80) || undefined;
    const blastId = safeString(customArgs.blastId, 80) || undefined;
    const channelId = safeString(customArgs.channelId, 80) || undefined;
    const contactType = safeString(customArgs.contactType, 20);
    const contactId = safeString(customArgs.contactId, 120);

    const eventType = safeString(e?.event, 60)?.toUpperCase() || 'UNKNOWN';
    const email = safeString(e?.email, 200);
    const messageId = safeString(e?.sg_message_id || e?.message_id || e?.['smtp-id'], 200);
    const url = safeString(e?.url, 900);
    const ip = safeString(e?.ip, 80);
    const userAgent = safeString(e?.useragent, 400);
    const occurredAt = toDateFromEpochSeconds(e?.timestamp);

    inserts.push(prisma.marketingEmailEvent.create({
      data: {
        provider: 'sendgrid',
        eventType,
        email,
        messageId,
        url,
        ip,
        userAgent,
        occurredAt,
        agentId: agentId || null,
        blastId: blastId || null,
        channelId: channelId || null,
        meta: e,
      },
    }));

    if (agentId && contactType && contactId) {
      inserts.push(
        prisma.internalEvent.create({
          data: {
            agentId,
            kind: 'contact_email_event',
            path: '/api/integrations/sendgrid/events',
            meta: {
              contactType,
              contactId,
              contactEmail: email || null,
              eventType,
              messageId: messageId || null,
            },
          },
        }),
      );
    }
  }

  try {
    if (inserts.length) {
      // Use transaction for atomicity; cap already applied.
      await prisma.$transaction(inserts);
    }
  } catch (err) {
    // Best-effort: return 200 so SendGrid doesn't retry forever, but surface internally.
    console.error('SendGrid webhook ingest failed', err);
  }

  return res.json({ ok: true, received: events.length, stored: inserts.length, signatureOk, secretOk });
}
