import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { buildContactReplyToAddress } from '../services/contactReplyToken';

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

    const [agent, contact] = await Promise.all([
      prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, email: true, name: true },
      }),
      getContact({ agentId, contactType, contactId }),
    ]);

    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.email) return res.status(400).json({ error: 'Contact does not have an email address' });

    const replyTo = buildContactReplyToAddress({
      agentId,
      contactType,
      contactId,
    }) || agent.email;

    const sendResult = await sendEmail({
      to: contact.email,
      cc: ccAgent ? agent.email : undefined,
      subject,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.55; color: #1f2937;">${bodyToHtml(body)}</div>`,
      text: body,
      replyTo,
      fromName: agent.name ? `${agent.name} via AgentEase Pro` : 'AgentEase Pro',
      categories: ['contact-email'],
      customArgs: {
        agentId,
        contactType,
        contactId,
      },
    });

    const sentAt = new Date();

    await prisma.internalEvent.create({
      data: {
        agentId,
        kind: sendResult.success ? 'contact_email_sent' : 'contact_email_failed',
        path: '/api/contact-email/send',
        meta: {
          contactType,
          contactId,
          contactEmail: contact.email,
          contactName: contact.name,
          subject,
          body,
          ccAgent,
          replyTo,
          messageId: sendResult.messageId || null,
          error: sendResult.error || null,
        },
      },
    });

    if (contactType === 'lead' && contact.leadId) {
      await prisma.leadActivity.create({
        data: {
          leadId: contact.leadId,
          activityType: 'EMAIL',
          description: sendResult.success
            ? `Email sent: ${subject}`
            : `Email failed: ${subject}${sendResult.error ? ` (${sendResult.error})` : ''}`,
          metadata: {
            source: 'contact_email',
            messageId: sendResult.messageId || null,
            ccAgent,
          },
        },
      });

      await prisma.lead.update({
        where: { id: contact.leadId },
        data: { lastContact: sentAt },
      });
    }

    if (contactType === 'client' && contact.clientId && sendResult.success) {
      await prisma.client.update({
        where: { id: contact.clientId },
        data: { lastContactAt: sentAt },
      });
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

    const [events, lastSeenEvent] = await Promise.all([
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
    ]);

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
    console.error('Error fetching recent replies:', error);
    return res.status(500).json({ error: 'Failed to fetch recent replies' });
  }
});

router.post('/recent-replies/mark-seen', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    await prisma.internalEvent.create({
      data: {
        agentId: req.agentId,
        kind: 'contact_email_replies_seen',
        path: '/api/contact-email/recent-replies/mark-seen',
        meta: {
          seenAt: now.toISOString(),
        },
      },
    });

    return res.json({ ok: true, seenAt: now.toISOString() });
  } catch (error) {
    console.error('Error marking recent replies seen:', error);
    return res.status(500).json({ error: 'Failed to mark replies seen' });
  }
});
