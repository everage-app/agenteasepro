import { Router } from 'express';
import {
  BlastStatus,
  BlastPlaybook,
  BlastChannelType,
  ClientStage,
  ClientTemperature,
  Prisma,
} from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  createBlastFromListing,
  generateBlastContent,
  generateUniqueShortCode,
  computeShortLink,
  resolveBlastDestination,
} from '../services/marketingService';
import { dispatchAutomationEvent } from '../automation/runner';
import { sendMarketingEmail } from '../services/emailService';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
export const router = Router();

const DirectMailRecipientsSchema = z
  .object({
    stage: z.union([z.nativeEnum(ClientStage), z.array(z.nativeEnum(ClientStage)).min(1)]).optional(),
    temperature: z
      .union([z.nativeEnum(ClientTemperature), z.array(z.nativeEnum(ClientTemperature)).min(1)])
      .optional(),
    tagsAny: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    requireAddress: z.boolean().default(true),
    limit: z.number().int().min(1).max(10000).default(5000),
  })
  .strict();

const DirectMailCsvSchema = DirectMailRecipientsSchema.extend({
  markLastMarketingAt: z.boolean().default(false),
}).strict();

function asArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\r\n,"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function shortLinkBase(req: AuthenticatedRequest) {
  return process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function requireBlast(agentId: string, blastId: string) {
  const blast = await prisma.marketingBlast.findFirst({
    where: { id: blastId, agentId },
    include: { listing: true, channels: { orderBy: { channel: 'asc' } } },
  });
  if (!blast) {
    const err = new Error('Blast not found');
    (err as any).statusCode = 404;
    throw err;
  }
  return blast;
}

const SendBlastSchema = z
  .object({
    audienceType: z.enum(['CLIENTS', 'LEADS', 'DEALS']).default('CLIENTS'),
    limit: z.number().int().min(1).max(2000).default(100),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict();

const MONTHLY_MARKETING_EMAIL_LIMIT = 200;

const MassEmailSchema = z
  .object({
    audienceType: z.enum(['CLIENTS', 'LEADS', 'CLIENTS_AND_LEADS']).default('CLIENTS_AND_LEADS'),
    subject: z.string().trim().min(3).max(180),
    message: z.string().trim().min(5).max(25000),
    limit: z.number().int().min(1).max(200).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict();

const MassEmailPreviewSchema = z
  .object({
    audienceType: z.enum(['CLIENTS', 'LEADS', 'CLIENTS_AND_LEADS']).default('CLIENTS_AND_LEADS'),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

async function getMonthlyMarketingEmailUsage(agentId: string) {
  const { start, end } = getMonthRange();
  const rows = await prisma.marketingDeliveryLog.findMany({
    where: {
      agentId,
      status: 'SENT',
      createdAt: { gte: start, lt: end },
    },
    select: { recipientsCount: true },
  });

  const used = rows.reduce((sum, row) => sum + (row.recipientsCount || 0), 0);
  const remaining = Math.max(0, MONTHLY_MARKETING_EMAIL_LIMIT - used);

  return {
    limit: MONTHLY_MARKETING_EMAIL_LIMIT,
    used,
    remaining,
    monthStart: start,
    monthEnd: end,
  };
}

async function resolveMassEmailRecipients(params: {
  agentId: string;
  audienceType: 'CLIENTS' | 'LEADS' | 'CLIENTS_AND_LEADS';
  maxRecipients: number;
}) {
  const maxRecipients = Math.max(1, Math.min(params.maxRecipients, MONTHLY_MARKETING_EMAIL_LIMIT));

  const includeClients = params.audienceType === 'CLIENTS' || params.audienceType === 'CLIENTS_AND_LEADS';
  const includeLeads = params.audienceType === 'LEADS' || params.audienceType === 'CLIENTS_AND_LEADS';

  const [clients, leads] = await Promise.all([
    includeClients
      ? prisma.client.findMany({
          where: { agentId: params.agentId, email: { not: null } },
          select: { email: true },
          orderBy: { createdAt: 'desc' },
          take: maxRecipients,
        })
      : Promise.resolve([]),
    includeLeads
      ? prisma.lead.findMany({
          where: { agentId: params.agentId, email: { not: null }, converted: false },
          select: { email: true },
          orderBy: { createdAt: 'desc' },
          take: maxRecipients,
        })
      : Promise.resolve([]),
  ]);

  const deduped = Array.from(
    new Set(
      [...clients.map((c) => c.email), ...leads.map((l) => l.email)]
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim().toLowerCase()),
    ),
  );

  return deduped.slice(0, maxRecipients);
}

let processingScheduledMassEmails = false;

export async function processDueScheduledMassEmails() {
  if (processingScheduledMassEmails) return;
  processingScheduledMassEmails = true;

  try {
    const schedulerBaseUrl =
      process.env.PUBLIC_API_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      'https://agenteasepro-3cf0df357839.herokuapp.com';

    const dueBlasts = await prisma.marketingBlast.findMany({
      where: {
        status: BlastStatus.SCHEDULED,
        scheduledAt: { lte: new Date() },
        channels: {
          some: {
            enabled: true,
            channel: BlastChannelType.EMAIL,
            status: BlastStatus.SCHEDULED,
          },
        },
      },
      include: {
        listing: true,
        channels: true,
      },
      take: 20,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const blast of dueBlasts) {
      try {
        const scheduleConfig = await prisma.marketingDeliveryLog.findFirst({
          where: {
            blastId: blast.id,
            status: 'SCHEDULED',
            audienceType: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });

        const audienceType =
          (scheduleConfig?.audienceType as 'CLIENTS' | 'LEADS' | 'DEALS' | 'CLIENTS_AND_LEADS' | null) ||
          'CLIENTS_AND_LEADS';
        const requestedLimit = Math.max(1, Math.min(scheduleConfig?.recipientsCount ?? 100, 200));

        const recipients = audienceType === 'CLIENTS_AND_LEADS'
          ? await resolveMassEmailRecipients({
              agentId: blast.agentId,
              audienceType,
              maxRecipients: requestedLimit,
            })
          : await resolveEmailRecipients({
              agentId: blast.agentId,
              audienceType,
              limit: requestedLimit,
            });

        const emailChannels = blast.channels.filter(
          (channel) => channel.enabled && channel.channel === BlastChannelType.EMAIL,
        );

        const usage = await getMonthlyMarketingEmailUsage(blast.agentId);
        const projectedSendCount = recipients.length * emailChannels.length;
        if (usage.remaining <= 0 || projectedSendCount > usage.remaining) {
          await prisma.$transaction([
            prisma.marketingBlast.update({
              where: { id: blast.id },
              data: { status: BlastStatus.DRAFT, scheduledAt: null },
            }),
            prisma.blastChannel.updateMany({
              where: { blastId: blast.id, channel: BlastChannelType.EMAIL },
              data: { status: BlastStatus.DRAFT },
            }),
            prisma.marketingDeliveryLog.create({
              data: {
                agentId: blast.agentId,
                blastId: blast.id,
                provider: 'sendgrid',
                status: 'FAILED',
                subject: blast.title,
                recipientsCount: 0,
                recipientsSample: [],
                audienceType,
                error:
                  usage.remaining <= 0
                    ? 'Scheduled send skipped: monthly email limit reached.'
                    : `Scheduled send skipped: monthly email limit exceeded (requested ${projectedSendCount}, remaining ${usage.remaining}).`,
              },
            }),
          ]);
          continue;
        }

        if (recipients.length === 0 || emailChannels.length === 0) {
          await prisma.$transaction([
            prisma.marketingBlast.update({
              where: { id: blast.id },
              data: { status: BlastStatus.DRAFT, scheduledAt: null },
            }),
            prisma.blastChannel.updateMany({
              where: { blastId: blast.id, channel: BlastChannelType.EMAIL },
              data: { status: BlastStatus.DRAFT },
            }),
            prisma.marketingDeliveryLog.create({
              data: {
                agentId: blast.agentId,
                blastId: blast.id,
                provider: 'sendgrid',
                status: 'FAILED',
                subject: blast.title,
                recipientsCount: recipients.length,
                recipientsSample: recipients.slice(0, 12),
                audienceType,
                error: recipients.length === 0 ? 'Scheduled send skipped: no recipients found.' : 'Scheduled send skipped: no email channels enabled.',
              },
            }),
          ]);
          continue;
        }

        const enabledChannels = blast.channels.filter((channel) => channel.enabled);
        const linkTx: Prisma.PrismaPromise<any>[] = [];
        const channelShortUrls = new Map<string, string>();
        for (const channel of enabledChannels) {
          let shortCode = channel.shortCode;
          if (!shortCode) shortCode = await generateUniqueShortCode();
          const shortUrl = computeShortLink(schedulerBaseUrl, shortCode);
          channelShortUrls.set(channel.id, shortUrl);
          linkTx.push(
            prisma.blastChannel.update({
              where: { id: channel.id },
              data: { shortCode, shortUrl },
            }),
          );
        }
        if (linkTx.length) {
          await prisma.$transaction(linkTx);
        }

        const agent = await prisma.agent.findUnique({ where: { id: blast.agentId }, select: { name: true } });
        let sentAny = false;

        for (const channel of emailChannels) {
          const shortUrl = channelShortUrls.get(channel.id) || channel.shortUrl || '';
          const emailHtml = channel.previewHtml || `<p>${channel.previewText || blast.title}</p>`;
          const htmlContent = blast.listingId
            ? `
              ${emailHtml}
              <div style="margin-top: 24px; text-align: center;">
                <a href="${shortUrl}" style="display: inline-block; background: linear-gradient(135deg, #3091f6 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View Details
                </a>
              </div>
            `
            : emailHtml;

          const result = await sendMarketingEmail({
            recipients,
            subject: channel.previewText || blast.title,
            htmlContent,
            listingAddress: blast.listing?.headline || undefined,
            agentName: agent?.name || undefined,
            categories: ['marketing_blast', blast.playbook === BlastPlaybook.CUSTOM ? 'mass_email' : 'listing_blast', 'scheduled'],
            customArgs: {
              agentId: blast.agentId,
              blastId: blast.id,
              channelId: channel.id,
              audienceType,
            },
          });

          await prisma.marketingDeliveryLog.create({
            data: {
              agentId: blast.agentId,
              blastId: blast.id,
              channelId: channel.id,
              provider: 'sendgrid',
              status: result.success ? 'SENT' : 'FAILED',
              messageId: result.messageId,
              subject: channel.previewText || blast.title,
              recipientsCount: recipients.length,
              recipientsSample: recipients.slice(0, 12),
              audienceType,
              error: result.success ? null : result.error || 'SendGrid send failed',
            },
          });

          if (result.success) {
            sentAny = true;
            await prisma.blastChannel.update({
              where: { id: channel.id },
              data: { status: BlastStatus.SENT, externalId: result.messageId },
            });
          } else {
            await prisma.blastChannel.update({
              where: { id: channel.id },
              data: { status: BlastStatus.DRAFT },
            });
          }
        }

        if (sentAny) {
          await prisma.blastChannel.updateMany({
            where: {
              blastId: blast.id,
              enabled: true,
              channel: { not: BlastChannelType.EMAIL },
            },
            data: { status: BlastStatus.SENT },
          });
        }

        await prisma.marketingBlast.update({
          where: { id: blast.id },
          data: sentAny
            ? { status: BlastStatus.SENT, sentAt: new Date(), scheduledAt: null }
            : { status: BlastStatus.DRAFT, scheduledAt: null },
        });

        if (sentAny) {
          dispatchAutomationEvent({
            type: 'MARKETING_BLAST_SENT',
            blastId: blast.id,
            agentId: blast.agentId,
          }).catch((err) => console.error('Automation dispatch failed:', err));
        }
      } catch (blastError) {
        console.error('Failed scheduled mass email send for blast', blast.id, blastError);
      }
    }
  } finally {
    processingScheduledMassEmails = false;
  }
}

router.get('/email/quota', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const usage = await getMonthlyMarketingEmailUsage(req.agentId);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

router.post('/email/preview', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = MassEmailPreviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const usage = await getMonthlyMarketingEmailUsage(req.agentId);
    if (usage.remaining <= 0) {
      return res.json({
        ...usage,
        audienceType: parsed.data.audienceType,
        recipientsCount: 0,
        sample: [],
      });
    }

    const requestedLimit = Math.max(1, Math.min(parsed.data.limit ?? usage.remaining, usage.remaining));
    const recipients = await resolveMassEmailRecipients({
      agentId: req.agentId,
      audienceType: parsed.data.audienceType,
      maxRecipients: requestedLimit,
    });

    res.json({
      ...usage,
      audienceType: parsed.data.audienceType,
      recipientsCount: recipients.length,
      sample: recipients.slice(0, 12),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/email/send', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = MassEmailSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const usage = await getMonthlyMarketingEmailUsage(req.agentId);
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now());

    if (usage.remaining <= 0 && !isScheduled) {
      return res.status(429).json({
        error: `Monthly email limit reached (${usage.limit}/${usage.limit}).`,
        ...usage,
      });
    }

    const maxAllowed = isScheduled ? MONTHLY_MARKETING_EMAIL_LIMIT : usage.remaining;
    const requestedLimit = Math.max(1, Math.min(parsed.data.limit ?? maxAllowed, maxAllowed));

    const safeMessage = parsed.data.message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    const messageHtml = safeMessage.includes('<')
      ? safeMessage
      : safeMessage
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p style="margin: 0 0 12px;">${line}</p>`)
          .join('');

    const agent = await prisma.agent.findUnique({ where: { id: req.agentId }, select: { name: true } });

    const blast = await prisma.marketingBlast.create({
      data: {
        agentId: req.agentId,
        title: parsed.data.subject,
        playbook: BlastPlaybook.CUSTOM,
        status: isScheduled ? BlastStatus.SCHEDULED : BlastStatus.DRAFT,
        scheduledAt: isScheduled ? scheduledAt : null,
        channels: {
          create: {
            channel: BlastChannelType.EMAIL,
            enabled: true,
            previewText: parsed.data.subject,
            previewHtml: messageHtml,
            status: isScheduled ? BlastStatus.SCHEDULED : BlastStatus.DRAFT,
          },
        },
      },
      include: { channels: true },
    });

    const emailChannel = blast.channels[0];

    if (isScheduled) {
      await prisma.marketingDeliveryLog.create({
        data: {
          agentId: req.agentId,
          blastId: blast.id,
          channelId: emailChannel.id,
          provider: 'sendgrid',
          status: 'SCHEDULED',
          subject: parsed.data.subject,
          recipientsCount: requestedLimit,
          recipientsSample: [],
          audienceType: parsed.data.audienceType,
          error: null,
        },
      });

      return res.json({
        blastId: blast.id,
        scheduled: true,
        scheduledAt,
        audienceType: parsed.data.audienceType,
        recipientsCount: requestedLimit,
        ...usage,
      });
    }

    const recipients = await resolveMassEmailRecipients({
      agentId: req.agentId,
      audienceType: parsed.data.audienceType,
      maxRecipients: requestedLimit,
    });

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found for selected audience' });
    }

    const result = await sendMarketingEmail({
      recipients,
      subject: parsed.data.subject,
      htmlContent: messageHtml,
      agentName: agent?.name || undefined,
      categories: ['marketing_blast', 'mass_email'],
      customArgs: {
        agentId: req.agentId,
        blastId: blast.id,
        channelId: emailChannel.id,
        audienceType: parsed.data.audienceType,
      },
    });

    await prisma.marketingDeliveryLog.create({
      data: {
        agentId: req.agentId,
        blastId: blast.id,
        channelId: emailChannel.id,
        provider: 'sendgrid',
        status: result.success ? 'SENT' : 'FAILED',
        messageId: result.messageId,
        subject: parsed.data.subject,
        recipientsCount: recipients.length,
        recipientsSample: recipients.slice(0, 12),
        audienceType: parsed.data.audienceType,
        error: result.success ? null : result.error || 'SendGrid send failed',
      },
    });

    if (!result.success) {
      return res.status(502).json({ error: result.error || 'Email send failed' });
    }

    await prisma.$transaction([
      prisma.blastChannel.update({
        where: { id: emailChannel.id },
        data: {
          status: BlastStatus.SENT,
          externalId: result.messageId,
        },
      }),
      prisma.marketingBlast.update({
        where: { id: blast.id },
        data: {
          status: BlastStatus.SENT,
          sentAt: new Date(),
          scheduledAt: null,
        },
      }),
    ]);

    const updatedUsage = await getMonthlyMarketingEmailUsage(req.agentId);

    res.json({
      blastId: blast.id,
      scheduled: false,
      audienceType: parsed.data.audienceType,
      recipientsCount: recipients.length,
      messageId: result.messageId,
      ...updatedUsage,
    });
  } catch (err) {
    next(err);
  }
});

async function resolveEmailRecipients(params: {
  agentId: string;
  audienceType: 'CLIENTS' | 'LEADS' | 'DEALS';
  limit: number;
}) {
  const limit = Math.min(params.limit, 2000);

  if (params.audienceType === 'LEADS') {
    const leads = await prisma.lead.findMany({
      where: { agentId: params.agentId, converted: false },
      select: { email: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Array.from(new Set(leads.map((l) => l.email).filter(Boolean)));
  }

  if (params.audienceType === 'DEALS') {
    const deals = await prisma.deal.findMany({
      where: {
        agentId: params.agentId,
        status: { notIn: ['CLOSED', 'FELL_THROUGH'] },
      },
      select: {
        buyer: { select: { email: true } },
        seller: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const emails: string[] = [];
    for (const d of deals) {
      if (d.buyer?.email) emails.push(d.buyer.email);
      if (d.seller?.email) emails.push(d.seller.email);
    }
    return Array.from(new Set(emails.filter(Boolean)));
  }

  // CLIENTS
  const clients = await prisma.client.findMany({
    where: { agentId: params.agentId, email: { not: null } },
    select: { email: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return Array.from(new Set(clients.map((c) => c.email!).filter(Boolean)));
}

router.get('/blasts', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const blasts = await prisma.marketingBlast.findMany({
      where: { agentId: req.agentId },
      orderBy: { createdAt: 'desc' },
      include: { listing: true, channels: true },
    });
    res.json(blasts);
  } catch (err) {
    next(err);
  }
});

router.get('/blasts/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const blast = await requireBlast(req.agentId, req.params.id);
    res.json(blast);
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [events30, events7, sent30] = await Promise.all([
      prisma.marketingEmailEvent.findMany({
        where: { agentId: req.agentId, occurredAt: { gte: days30 } },
        select: { eventType: true },
      }),
      prisma.marketingEmailEvent.findMany({
        where: { agentId: req.agentId, occurredAt: { gte: days7 } },
        select: { eventType: true },
      }),
      prisma.marketingDeliveryLog.count({
        where: { agentId: req.agentId, status: 'SENT', createdAt: { gte: days30 } },
      }),
    ]);

    const rollup = (rows: Array<{ eventType: string }>) => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        const k = (r.eventType || 'UNKNOWN').toUpperCase();
        out[k] = (out[k] || 0) + 1;
      }
      return out;
    };

    const byType30 = rollup(events30);
    const byType7 = rollup(events7);

    res.json({
      windowDays30: {
        sent: sent30,
        delivered: byType30.DELIVERED || 0,
        opens: byType30.OPEN || 0,
        clicks: byType30.CLICK || 0,
        bounces: (byType30.BOUNCE || 0) + (byType30.BLOCKED || 0) + (byType30.DROPPED || 0) + (byType30.DEFERRED || 0),
        unsubscribes: byType30.UNSUBSCRIBE || 0,
        spamReports: byType30.SPAMREPORT || 0,
      },
      windowDays7: {
        delivered: byType7.DELIVERED || 0,
        opens: byType7.OPEN || 0,
        clicks: byType7.CLICK || 0,
        bounces: (byType7.BOUNCE || 0) + (byType7.BLOCKED || 0) + (byType7.DROPPED || 0) + (byType7.DEFERRED || 0),
        unsubscribes: byType7.UNSUBSCRIBE || 0,
        spamReports: byType7.SPAMREPORT || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/blasts', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const CreateBlastSchema = z
      .object({
        listingId: z.string().min(1),
        playbook: z.nativeEnum(BlastPlaybook).optional(),
        channels: z
          .array(z.nativeEnum(BlastChannelType))
          .min(1)
          .max(20)
          .optional(),
      })
      .strict();

    const parsed = CreateBlastSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const created = await createBlastFromListing({
      agentId: req.agentId,
      listingId: parsed.data.listingId,
      playbook: parsed.data.playbook ?? BlastPlaybook.NEW_LISTING,
      channels: parsed.data.channels,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.post('/blasts/:id/generate', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    await requireBlast(req.agentId, req.params.id);
    const updated = await generateBlastContent(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/blasts/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const blast = await requireBlast(req.agentId, req.params.id);
    const { title, channels } = req.body as {
      title?: string;
      channels?: Array<{ id: string; previewText?: string | null; previewHtml?: string | null; enabled?: boolean }>;
    };

    const tx: Prisma.PrismaPromise<any>[] = [];
    if (title && title !== blast.title) {
      tx.push(prisma.marketingBlast.update({ where: { id: blast.id }, data: { title } }));
    }
    if (Array.isArray(channels)) {
      for (const channel of channels) {
        const channelUpdate: Record<string, any> = {
          previewText: channel.previewText,
          previewHtml: channel.previewHtml,
        };
        if (typeof channel.enabled === 'boolean') {
          channelUpdate.enabled = channel.enabled;
        }
        tx.push(
          prisma.blastChannel.update({
            where: { id: channel.id },
            data: channelUpdate,
          }),
        );
      }
    }
    await prisma.$transaction(tx);
    const refreshed = await requireBlast(req.agentId, req.params.id);
    res.json(refreshed);
  } catch (err) {
    next(err);
  }
});

router.post('/blasts/:id/send', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const blast = await requireBlast(req.agentId, req.params.id);
    const parsed = SendBlastSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const audienceType = parsed.data.audienceType;
    const limit = parsed.data.limit;
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now());
    const baseUrl = shortLinkBase(req);

    // Get agent info for email sender name
    const agent = await prisma.agent.findUnique({ where: { id: req.agentId } });

    const enabledChannels = blast.channels.filter((c) => c.enabled);
    if (enabledChannels.length === 0) {
      return res.status(400).json({ error: 'No enabled channels to send' });
    }

    // Ensure all channels have short links before sending
    const linkTx: Prisma.PrismaPromise<any>[] = [];
    const channelShortUrls = new Map<string, string>();
    for (const channel of enabledChannels) {
      let shortCode = channel.shortCode;
      if (!shortCode) shortCode = await generateUniqueShortCode();
      const shortUrl = computeShortLink(baseUrl, shortCode);
      channelShortUrls.set(channel.id, shortUrl);
      linkTx.push(
        prisma.blastChannel.update({
          where: { id: channel.id },
          data: { shortCode, shortUrl },
        }),
      );
    }
    await prisma.$transaction(linkTx);

    // Resolve recipients once per send
    const recipientEmails = await resolveEmailRecipients({
      agentId: req.agentId,
      audienceType,
      limit,
    });

    const emailChannels = enabledChannels.filter((c) => c.channel === BlastChannelType.EMAIL);

    if (isScheduled) {
      if (emailChannels.length === 0) {
        return res.status(400).json({ error: 'Scheduling requires at least one enabled email channel.' });
      }

      await prisma.$transaction([
        prisma.marketingBlast.update({
          where: { id: blast.id },
          data: {
            status: BlastStatus.SCHEDULED,
            scheduledAt,
          },
        }),
        prisma.blastChannel.updateMany({
          where: {
            blastId: blast.id,
            channel: BlastChannelType.EMAIL,
            enabled: true,
          },
          data: {
            status: BlastStatus.SCHEDULED,
          },
        }),
      ]);

      await prisma.marketingDeliveryLog.create({
        data: {
          agentId: req.agentId,
          blastId: blast.id,
          provider: 'sendgrid',
          status: 'SCHEDULED',
          subject: blast.title,
          recipientsCount: recipientEmails.length || limit,
          recipientsSample: recipientEmails.slice(0, 12),
          audienceType,
        },
      });

      const refreshed = await requireBlast(req.agentId, req.params.id);
      return res.json({
        ...refreshed,
        scheduled: true,
        scheduledAt,
        delivery: {
          audienceType,
          recipientsCount: recipientEmails.length || limit,
          results: [],
        },
      });
    }

    if (emailChannels.length > 0) {
      const usage = await getMonthlyMarketingEmailUsage(req.agentId);
      const projectedSendCount = recipientEmails.length * emailChannels.length;

      if (projectedSendCount > usage.remaining) {
        return res.status(429).json({
          error: `Monthly email limit exceeded. Remaining: ${usage.remaining}, requested: ${projectedSendCount}.`,
          ...usage,
          requested: projectedSendCount,
        });
      }
    }

    // Send actual emails for EMAIL channels and persist delivery logs
    const deliveryResults: Array<{ channelId: string; ok: boolean; error?: string; messageId?: string; recipientsCount: number }> = [];
    for (const channel of emailChannels) {
      if (!channel.previewHtml && !channel.previewText) {
        console.warn(`⚠️ Skipping email send for channel ${channel.id} - no content`);
        deliveryResults.push({ channelId: channel.id, ok: false, error: 'Missing email content', recipientsCount: 0 });
        continue;
      }

      if (recipientEmails.length === 0) {
        deliveryResults.push({ channelId: channel.id, ok: false, error: 'No recipients found', recipientsCount: 0 });
        continue;
      }

      // Build email content with CTA link
      const shortUrl = channelShortUrls.get(channel.id) || channel.shortUrl || '';
      const emailHtml = channel.previewHtml || `<p>${channel.previewText || ''}</p>`;
      const fullHtml = `
        ${emailHtml}
        <div style="margin-top: 24px; text-align: center;">
          <a href="${shortUrl}" style="display: inline-block; background: linear-gradient(135deg, #3091f6 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View Details
          </a>
        </div>
      `;

      const recipientsSample = recipientEmails.slice(0, 5);

      const result = await sendMarketingEmail({
        recipients: recipientEmails,
        subject: channel.previewText || blast.title,
        htmlContent: fullHtml,
        listingAddress: blast.listing?.headline || undefined,
        agentName: agent?.name || undefined,
        categories: ['marketing_blast'],
        customArgs: {
          agentId: req.agentId,
          blastId: blast.id,
          channelId: channel.id,
          audienceType,
        },
      });

      if (result.success) {
        console.log(`✅ Marketing email sent to ${recipientEmails.length} recipients for blast ${blast.id}`);
        deliveryResults.push({
          channelId: channel.id,
          ok: true,
          messageId: result.messageId,
          recipientsCount: recipientEmails.length,
        });
      } else {
        console.error(`❌ Marketing email failed for blast ${blast.id}:`, result.error);
        deliveryResults.push({
          channelId: channel.id,
          ok: false,
          error: result.error || 'SendGrid send failed',
          recipientsCount: recipientEmails.length,
        });
      }

      // Persist delivery log (success or failure)
      await prisma.marketingDeliveryLog.create({
        data: {
          agentId: req.agentId,
          blastId: blast.id,
          channelId: channel.id,
          provider: 'sendgrid',
          status: result.success ? 'SENT' : 'FAILED',
          messageId: result.messageId,
          subject: channel.previewText || blast.title,
          recipientsCount: recipientEmails.length,
          recipientsSample,
          audienceType,
          error: result.success ? null : result.error || 'SendGrid send failed',
        },
      });

      if (result.success && result.messageId) {
        await prisma.blastChannel.update({
          where: { id: channel.id },
          data: { externalId: result.messageId },
        });
      }
    }

    // Mark non-email channels as SENT (we don't have external delivery feedback)
    const nonEmailTx: Prisma.PrismaPromise<any>[] = [];
    for (const channel of enabledChannels.filter((c) => c.channel !== BlastChannelType.EMAIL)) {
      nonEmailTx.push(
        prisma.blastChannel.update({
          where: { id: channel.id },
          data: { status: BlastStatus.SENT },
        }),
      );
    }

    // Mark email channels as SENT only if send succeeded
    for (const r of deliveryResults.filter((d) => d.ok)) {
      nonEmailTx.push(
        prisma.blastChannel.update({
          where: { id: r.channelId },
          data: { status: BlastStatus.SENT },
        }),
      );
    }
    await prisma.$transaction(nonEmailTx);

    const anyEnabledSent = await prisma.blastChannel.count({
      where: { blastId: blast.id, enabled: true, status: BlastStatus.SENT },
    });

    if (anyEnabledSent > 0) {
      await prisma.marketingBlast.update({
        where: { id: blast.id },
        data: { status: BlastStatus.SENT, sentAt: new Date(), scheduledAt: null },
      });
    }

    const refreshed = await requireBlast(req.agentId, req.params.id);
    
    // Trigger automation workflows when blast is sent
    dispatchAutomationEvent({
      type: 'MARKETING_BLAST_SENT',
      blastId: blast.id,
      agentId: req.agentId,
    }).catch(err => console.error('Automation dispatch failed:', err));
    
    res.json({
      ...refreshed,
      destinationUrl: resolveBlastDestination(refreshed),
      delivery: {
        audienceType,
        recipientsCount: recipientEmails.length,
        results: deliveryResults,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/blasts/:id/deliveries', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    await requireBlast(req.agentId, req.params.id);
    const rows = await prisma.marketingDeliveryLog.findMany({
      where: { agentId: req.agentId, blastId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/blasts/:id/email-analytics', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    await requireBlast(req.agentId, req.params.id);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await prisma.marketingEmailEvent.findMany({
      where: { agentId: req.agentId, blastId: req.params.id, occurredAt: { gte: since } },
      select: { eventType: true },
    });

    const byType: Record<string, number> = {};
    for (const e of events) {
      const k = (e.eventType || 'UNKNOWN').toUpperCase();
      byType[k] = (byType[k] || 0) + 1;
    }

    res.json({
      windowDays: 30,
      delivered: byType.DELIVERED || 0,
      opens: byType.OPEN || 0,
      clicks: byType.CLICK || 0,
      bounces: (byType.BOUNCE || 0) + (byType.BLOCKED || 0) + (byType.DROPPED || 0) + (byType.DEFERRED || 0),
      unsubscribes: byType.UNSUBSCRIBE || 0,
      spamReports: byType.SPAMREPORT || 0,
      raw: byType,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/marketing/direct-mail/recipients
 * Build a direct mail recipient list (clients with addresses), filtered by stage/temperature/tags.
 */
router.post('/direct-mail/recipients', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = DirectMailRecipientsSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const stageIn = asArray(parsed.data.stage);
    const temperatureIn = asArray(parsed.data.temperature);
    const tagsAny = parsed.data.tagsAny?.filter(Boolean);
    const search = parsed.data.search;

    const where: Prisma.ClientWhereInput = {
      agentId: req.agentId,
      ...(stageIn ? { stage: { in: stageIn } } : {}),
      ...(temperatureIn ? { temperature: { in: temperatureIn } } : {}),
      ...(tagsAny?.length ? { tags: { hasSome: tagsAny } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { mailingAddress: { contains: search, mode: 'insensitive' } },
              { mailingCity: { contains: search, mode: 'insensitive' } },
              { mailingState: { contains: search, mode: 'insensitive' } },
              { mailingZip: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (parsed.data.requireAddress) {
      where.AND = [
        { mailingAddress: { not: null } },
        { mailingCity: { not: null } },
        { mailingState: { not: null } },
        { mailingZip: { not: null } },
        { mailingAddress: { not: '' } },
        { mailingCity: { not: '' } },
        { mailingState: { not: '' } },
        { mailingZip: { not: '' } },
      ];
    }

    const recipients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        temperature: true,
        tags: true,
        mailingAddress: true,
        mailingCity: true,
        mailingState: true,
        mailingZip: true,
        lastMarketingAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: parsed.data.limit,
    });

    res.json({
      count: recipients.length,
      recipients,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/marketing/direct-mail/recipients.csv
 * Export direct mail recipients to CSV.
 */
router.post('/direct-mail/recipients.csv', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = DirectMailCsvSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const stageIn = asArray(parsed.data.stage);
    const temperatureIn = asArray(parsed.data.temperature);
    const tagsAny = parsed.data.tagsAny?.filter(Boolean);
    const search = parsed.data.search;

    const where: Prisma.ClientWhereInput = {
      agentId: req.agentId,
      ...(stageIn ? { stage: { in: stageIn } } : {}),
      ...(temperatureIn ? { temperature: { in: temperatureIn } } : {}),
      ...(tagsAny?.length ? { tags: { hasSome: tagsAny } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { mailingAddress: { contains: search, mode: 'insensitive' } },
              { mailingCity: { contains: search, mode: 'insensitive' } },
              { mailingState: { contains: search, mode: 'insensitive' } },
              { mailingZip: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (parsed.data.requireAddress) {
      where.AND = [
        { mailingAddress: { not: null } },
        { mailingCity: { not: null } },
        { mailingState: { not: null } },
        { mailingZip: { not: null } },
        { mailingAddress: { not: '' } },
        { mailingCity: { not: '' } },
        { mailingState: { not: '' } },
        { mailingZip: { not: '' } },
      ];
    }

    const recipients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        temperature: true,
        tags: true,
        mailingAddress: true,
        mailingCity: true,
        mailingState: true,
        mailingZip: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: parsed.data.limit,
    });

    if (parsed.data.markLastMarketingAt && recipients.length > 0) {
      await prisma.client.updateMany({
        where: { agentId: req.agentId, id: { in: recipients.map((r) => r.id) } },
        data: { lastMarketingAt: new Date() },
      });
    }

    const headers = [
      'First Name',
      'Last Name',
      'Street',
      'City',
      'State',
      'Zip',
      'Temperature',
      'Stage',
      'Tags',
    ];

    const lines = [headers.map(csvEscape).join(',')];
    for (const r of recipients) {
      lines.push(
        [
          r.firstName,
          r.lastName,
          r.mailingAddress,
          r.mailingCity,
          r.mailingState,
          r.mailingZip,
          r.temperature,
          r.stage,
          (r.tags || []).join(' | '),
        ]
          .map(csvEscape)
          .join(','),
      );
    }

    const csv = lines.join('\r\n');
    const filename = `direct-mail-recipients-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
