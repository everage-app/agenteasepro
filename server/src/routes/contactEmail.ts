import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { resolveEmailIdentity, sendEmail } from '../services/emailService';
import { buildContactReplyToAddress, generateContactReplyToken } from '../services/contactReplyToken';
import { isTransientPrismaError, withPrismaRetry } from '../lib/prismaRetry';

export const router = Router();

router.use(authenticateToken);

const sendContactEmailSchema = z
  .object({
    contactType: z.enum(['lead', 'client']),
    contactId: z.string().trim().min(1),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(10000),
    ccAgent: z.boolean().optional().default(false),
  })
  .strict();

const templateCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

const templateUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    subject: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
  })
  .strict();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\r?\n/g, '<br/>');
}

function normalizeValue(value: string | null | undefined): string {
  return (value || '').trim();
}

function formatIsoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function applyMergeTags(input: string, mergeTags: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const normalizedKey = key.trim();
    return Object.prototype.hasOwnProperty.call(mergeTags, normalizedKey)
      ? mergeTags[normalizedKey]
      : _match;
  });
}

async function getContact(params: {
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
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      name: `${lead.firstName} ${lead.lastName}`.trim(),
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
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    name: `${client.firstName} ${client.lastName}`.trim(),
    email: client.email,
    leadId: null as string | null,
    clientId: client.id,
    contactType: 'client' as const,
  };
}

router.post('/send', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = sendContactEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email payload' });
    }

    const { contactType, contactId, subject, body, ccAgent } = parsed.data;
    const agentId = req.agentId;

    const [agent, contact, emailChannel] = await withPrismaRetry(() =>
      Promise.all([
        prisma.agent.findUnique({
          where: { id: agentId },
          select: { id: true, email: true, name: true },
        }),
        getContact({ agentId, contactType, contactId }),
        prisma.agentChannelConnection.findUnique({
          where: {
            agentId_type: {
              agentId,
              type: 'EMAIL',
            },
          },
          select: { config: true },
        }),
      ]),
    );

    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.email) return res.status(400).json({ error: 'Contact does not have an email address' });

    const firstName = normalizeValue(contact.firstName || contact.name.split(' ')[0] || '');
    const lastName = normalizeValue(contact.lastName || contact.name.split(' ').slice(1).join(' ') || '');
    const fullName = normalizeValue(contact.name || `${firstName} ${lastName}`.trim());

    const mergeTags: Record<string, string> = {
      firstName,
      lastName,
      fullName,
      contactName: fullName,
      contactEmail: normalizeValue(contact.email),
      agentName: normalizeValue(agent.name),
      agentEmail: normalizeValue(agent.email),
      today: formatIsoDate(),
    };

    const resolvedSubject = applyMergeTags(subject, mergeTags);
    const resolvedBody = applyMergeTags(body, mergeTags);

    const replyToken = generateContactReplyToken();

    const replyTo = buildContactReplyToAddress({
      agentId,
      contactType,
      contactId,
      replyToken,
    }) || agent.email;

    const emailConfig = (emailChannel?.config || {}) as Record<string, unknown>;
    const requestedFromEmail = typeof emailConfig.fromEmail === 'string' ? emailConfig.fromEmail.trim() : '';
    const configuredFromName = typeof emailConfig.fromName === 'string' ? emailConfig.fromName.trim() : '';
    const senderIdentity = resolveEmailIdentity({
      fromEmail: requestedFromEmail || undefined,
      fromName: configuredFromName || (agent.name ? `${agent.name} via AgentEase Pro` : 'AgentEase Pro'),
      replyTo,
    });

    const sendResult = await sendEmail({
      to: contact.email,
      cc: ccAgent ? agent.email : undefined,
      subject: resolvedSubject,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.55; color: #1f2937;">${bodyToHtml(resolvedBody)}</div>`,
      text: resolvedBody,
      replyTo: senderIdentity.replyTo,
      fromEmail: senderIdentity.requestedFromEmail,
      fromName: senderIdentity.fromName,
      categories: ['contact-email'],
      customArgs: {
        agentId,
        contactType,
        contactId,
      },
    });

    const sentAt = new Date();

    try {
      await withPrismaRetry(() =>
        prisma.internalEvent.create({
          data: {
            agentId,
            kind: sendResult.success ? 'contact_email_sent' : 'contact_email_failed',
            path: '/api/contact-email/send',
            meta: {
              contactType,
              contactId,
              contactEmail: contact.email,
              contactName: contact.name,
              subject: resolvedSubject,
              body: resolvedBody,
              ccAgent,
              replyTo,
              replyToken,
              fromEmail: senderIdentity.fromEmail,
              requestedFromEmail: senderIdentity.requestedFromEmail || null,
              senderMode: senderIdentity.senderMode,
              messageId: sendResult.messageId || null,
              error: sendResult.error || null,
            },
          },
        }),
      );

      if (contactType === 'lead' && contact.leadId) {
        await withPrismaRetry(() =>
          prisma.leadActivity.create({
            data: {
              leadId: contact.leadId!,
              activityType: 'EMAIL',
              description: sendResult.success
                ? `Email sent: ${resolvedSubject}`
                : `Email failed: ${resolvedSubject}${sendResult.error ? ` (${sendResult.error})` : ''}`,
              metadata: {
                source: 'contact_email',
                messageId: sendResult.messageId || null,
                ccAgent,
              },
            },
          }),
        );

        await withPrismaRetry(() =>
          prisma.lead.update({
            where: { id: contact.leadId! },
            data: { lastContact: sentAt },
          }),
        );
      }

      if (contactType === 'client' && contact.clientId && sendResult.success) {
        await withPrismaRetry(() =>
          prisma.client.update({
            where: { id: contact.clientId! },
            data: { lastContactAt: sentAt },
          }),
        );
      }
    } catch (activityError) {
      console.error('Contact email sent but CRM activity logging failed:', activityError);
    }

    if (!sendResult.success) {
      return res.status(502).json({ error: sendResult.error || 'Failed to send email' });
    }

    return res.status(201).json({
      ok: true,
      messageId: sendResult.messageId || null,
      sentAt: sentAt.toISOString(),
    });
  } catch (error) {
    console.error('Error sending contact email:', error);
    return res.status(500).json({ error: 'Failed to send contact email' });
  }
});

router.get('/templates', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const items = await prisma.contactEmailTemplate.findMany({
      where: { agentId: req.agentId },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    });

    return res.json({ items });
  } catch (error) {
    console.error('Error loading contact email templates:', error);
    return res.status(500).json({ error: 'Failed to load templates' });
  }
});

router.post('/templates', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid template payload' });
    }

    const template = await prisma.contactEmailTemplate.create({
      data: {
        agentId: req.agentId,
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
    });

    return res.status(201).json({ item: template });
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') {
      return res.status(409).json({ error: 'Template name already exists' });
    }
    console.error('Error creating contact email template:', error);
    return res.status(500).json({ error: 'Failed to create template' });
  }
});

router.patch('/templates/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid template id' });

    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'Invalid template payload' });
    }

    const existing = await prisma.contactEmailTemplate.findFirst({
      where: { id, agentId: req.agentId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updated = await prisma.contactEmailTemplate.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ item: updated });
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') {
      return res.status(409).json({ error: 'Template name already exists' });
    }
    console.error('Error updating contact email template:', error);
    return res.status(500).json({ error: 'Failed to update template' });
  }
});

router.post('/templates/:id/used', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid template id' });

    const existing = await prisma.contactEmailTemplate.findFirst({
      where: { id, agentId: req.agentId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const item = await prisma.contactEmailTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return res.json({ item });
  } catch (error) {
    console.error('Error tracking contact email template usage:', error);
    return res.status(500).json({ error: 'Failed to track template usage' });
  }
});

router.delete('/templates/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid template id' });

    const existing = await prisma.contactEmailTemplate.findFirst({
      where: { id, agentId: req.agentId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.contactEmailTemplate.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting contact email template:', error);
    return res.status(500).json({ error: 'Failed to delete template' });
  }
});

router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const querySchema = z
      .object({
        contactType: z.enum(['lead', 'client']),
        contactId: z.string().trim().min(1),
      })
      .strict();

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid history query' });
    }

    const { contactType, contactId } = parsed.data;
    const agentId = req.agentId;

    const contact = await getContact({ agentId, contactType, contactId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const emailLower = (contact.email || '').toLowerCase();

    const [internalEvents, sendgridEvents] = await Promise.all([
      prisma.internalEvent.findMany({
        where: {
          agentId,
          kind: { in: ['contact_email_sent', 'contact_email_failed', 'contact_email_event', 'contact_email_reply_received'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.marketingEmailEvent.findMany({
        where: {
          agentId,
          ...(emailLower ? { email: { equals: emailLower, mode: 'insensitive' } } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        take: 250,
      }),
    ]);

    const isMetaForContact = (meta: any) => {
      if (!meta || typeof meta !== 'object') return false;
      return String(meta.contactType || '') === contactType && String(meta.contactId || '') === contactId;
    };

    const sentItems = internalEvents
      .filter((event) => isMetaForContact(event.meta))
      .map((event) => {
        const meta = (event.meta || {}) as any;
        const kind = event.kind === 'contact_email_failed'
          ? 'failed'
          : event.kind === 'contact_email_reply_received'
            ? 'reply'
            : event.kind === 'contact_email_event'
              ? 'event'
              : 'sent';
        return {
          id: event.id,
          kind,
          at: event.createdAt,
          subject: typeof meta.subject === 'string' ? meta.subject : null,
          body: typeof meta.body === 'string' ? meta.body : null,
          toEmail: typeof meta.contactEmail === 'string' ? meta.contactEmail : contact.email,
          fromEmail: typeof meta.fromEmail === 'string' ? meta.fromEmail : null,
          snippet: typeof meta.snippet === 'string' ? meta.snippet : null,
          ccAgent: Boolean(meta.ccAgent),
          messageId: typeof meta.messageId === 'string' ? meta.messageId : null,
          eventType: typeof meta.eventType === 'string' ? meta.eventType : null,
          error: typeof meta.error === 'string' ? meta.error : null,
          source: 'internal',
        };
      });

    const webhookItems = sendgridEvents
      .filter((event) => {
        const meta = (event.meta || {}) as any;
        const customArgs = (meta?.custom_args || meta?.unique_args || {}) as Record<string, unknown>;
        const metaContactType = String(customArgs.contactType || '');
        const metaContactId = String(customArgs.contactId || '');
        if (metaContactType && metaContactId) {
          return metaContactType === contactType && metaContactId === contactId;
        }

        return Boolean(emailLower && (event.email || '').toLowerCase() === emailLower);
      })
      .map((event) => ({
        id: event.id,
        kind: 'event',
        at: event.occurredAt,
        subject: null,
        body: null,
        toEmail: event.email || contact.email,
        fromEmail: null,
        snippet: null,
        ccAgent: false,
        messageId: event.messageId || null,
        eventType: event.eventType,
        error: null,
        source: 'sendgrid',
      }));

    const items = [...sentItems, ...webhookItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 120)
      .map((item) => ({
        ...item,
        at: new Date(item.at).toISOString(),
      }));

    return res.json({ items });
  } catch (error) {
    console.error('Error fetching contact email history:', error);
    return res.status(500).json({ error: 'Failed to fetch contact email history' });
  }
});

router.get('/recent-replies', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const querySchema = z
      .object({
        limit: z.coerce.number().int().min(1).max(25).optional().default(8),
      })
      .strict();

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query' });
    }

    const { limit } = parsed.data;

    const [events, lastSeenEvent] = await withPrismaRetry(() =>
      Promise.all([
        prisma.internalEvent.findMany({
          where: {
            agentId: req.agentId,
            kind: 'contact_email_reply_received',
          },
          orderBy: { createdAt: 'desc' },
          take: Math.max(limit * 4, 20),
        }),
        prisma.internalEvent.findFirst({
          where: {
            agentId: req.agentId,
            kind: 'contact_email_replies_seen',
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]),
    );

    const lastSeenAt = lastSeenEvent?.createdAt || null;

    const items = events
      .map((event) => {
        const meta = (event.meta || {}) as any;
        const contactType = String(meta.contactType || '') === 'client' ? 'client' : String(meta.contactType || '') === 'lead' ? 'lead' : null;
        const contactId = typeof meta.contactId === 'string' ? meta.contactId : null;
        if (!contactType || !contactId) return null;

        return {
          id: event.id,
          at: event.createdAt.toISOString(),
          contactType,
          contactId,
          contactName: typeof meta.contactName === 'string' && meta.contactName.trim() ? meta.contactName.trim() : contactType === 'lead' ? 'Lead' : 'Client',
          contactEmail: typeof meta.contactEmail === 'string' ? meta.contactEmail : null,
          fromEmail: typeof meta.fromEmail === 'string' ? meta.fromEmail : null,
          subject: typeof meta.subject === 'string' ? meta.subject : null,
          snippet: typeof meta.snippet === 'string' ? meta.snippet : null,
          unseen: lastSeenAt ? event.createdAt.getTime() > lastSeenAt.getTime() : true,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const deduped: typeof items = [];
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.contactType}:${item.contactId}:${item.subject || ''}:${item.snippet || ''}:${item.fromEmail || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }

    const unseenCount = deduped.filter((item) => item.unseen).length;

    return res.json({
      items: deduped,
      unseenCount,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    });
  } catch (error) {
    if (isTransientPrismaError(error)) {
      console.warn('Recent replies temporarily unavailable; returning degraded empty state:', error);
      return res.json({
        items: [],
        unseenCount: 0,
        lastSeenAt: null,
        degraded: true,
      });
    }
    console.error('Error fetching recent replies:', error);
    return res.status(500).json({ error: 'Failed to fetch recent replies' });
  }
});

router.post('/recent-replies/mark-seen', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    await withPrismaRetry(() =>
      prisma.internalEvent.create({
        data: {
          agentId: req.agentId,
          kind: 'contact_email_replies_seen',
          path: '/api/contact-email/recent-replies/mark-seen',
          meta: {
            seenAt: now.toISOString(),
          },
        },
      }),
    );

    return res.json({ ok: true, seenAt: now.toISOString() });
  } catch (error) {
    if (isTransientPrismaError(error)) {
      console.warn('Could not mark recent replies seen because the database was temporarily unavailable:', error);
      return res.status(202).json({ ok: false, retry: true });
    }
    console.error('Error marking recent replies seen:', error);
    return res.status(500).json({ error: 'Failed to mark replies seen' });
  }
});
