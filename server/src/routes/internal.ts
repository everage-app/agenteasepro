import { Router } from 'express';
import { BlastChannelType, BlastPlaybook, BlastStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { z } from 'zod';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AuthenticatedRequest } from '../middleware/auth';
import { isOwnerRequest, requireOwner } from '../middleware/requireOwner';
import { prisma } from '../lib/prisma';
import { getAgentLegalAcceptance, getLegalPolicies, updateLegalPolicies } from '../lib/legalPolicies';
import { fetchHerokuPricingSnapshot } from '../lib/herokuPricing';
import { sendMarketingEmail } from '../services/emailService';
export const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
  : null;

function mapStripeStatusToInternal(status: Stripe.Subscription.Status) {
  // Mirror agent-facing statuses
  return status;
}

function mapDbStatusToInternal(status: any) {
  switch (status) {
    case 'TRIAL':
      return 'trialing';
    case 'ACTIVE':
      return 'active';
    case 'PAST_DUE':
      return 'past_due';
    case 'CANCELED':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

async function ensureInternalStripeCustomer(agent: {
  id: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
}) {
  if (!stripe) return null;

  let customerId = agent.stripeCustomerId;

  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if ((existing as Stripe.DeletedCustomer).deleted) {
        customerId = null;
      }
    } catch (error: any) {
      if (error?.code === 'resource_missing') {
        customerId = null;
      } else {
        throw error;
      }
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agent.email,
      name: agent.name,
      metadata: { agentId: agent.id },
    });
    customerId = customer.id;
    await prisma.agent.update({ where: { id: agent.id }, data: { stripeCustomerId: customerId } });
  }

  return customerId;
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
});

const supportFilterSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  category: z.enum(['GENERAL', 'SUGGESTION', 'BILLING', 'BUG']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  q: z.string().trim().max(120).optional(),
});

const supportUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
});

const internalCampaignSchema = z.object({
  campaignName: z.string().trim().min(1).max(180).optional(),
  subject: z.string().trim().min(3).max(180),
  htmlTemplate: z.string().trim().min(20).max(300000),
  recipientsRaw: z.string().trim().min(5).max(3000000),
  fromEmail: z.string().email().optional(),
  fromName: z.string().trim().min(2).max(100).default('AgentEasePro Sales'),
  replyTo: z.string().email().optional(),
  batchSize: z.number().int().min(25).max(250).default(100),
  throttleMs: z.number().int().min(0).max(5000).default(1200),
  dryRun: z.boolean().default(false),
  utmCampaign: z.string().trim().min(1).max(120).optional(),
});

const suppressingEventTypes = ['UNSUBSCRIBE', 'SPAMREPORT', 'BOUNCE', 'BLOCKED', 'DROPPED'];

type InternalCampaignJob = {
  campaignId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  suppressedRecipients: number;
  processedBatches: number;
  totalBatches: number;
  subject: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  updatedAt: string;
};

const internalCampaignJobs = new Map<string, InternalCampaignJob>();
const internalCampaignLaunchIndex = new Map<
  string,
  {
    campaignId: string;
    createdAt: number;
  }
>();

const INTERNAL_CAMPAIGN_IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

function sanitizeCampaignHtml(input: string): string {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
}

function extractEmails(raw: string) {
  const matches = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const unique = new Set<string>();
  const invalid = new Set<string>();

  for (const candidate of matches) {
    const normalized = candidate.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      unique.add(normalized);
    } else {
      invalid.add(candidate);
    }
  }

  return {
    valid: Array.from(unique),
    invalid: Array.from(invalid),
  };
}

async function findSuppressedEmails(emails: string[]) {
  if (!emails.length) return new Set<string>();
  const suppressed = new Set<string>();
  const chunkSize = 900;

  for (let index = 0; index < emails.length; index += chunkSize) {
    const chunk = emails.slice(index, index + chunkSize);
    const rows = await prisma.marketingEmailEvent.findMany({
      where: {
        eventType: { in: suppressingEventTypes },
        email: { in: chunk },
      },
      select: { email: true },
      distinct: ['email'],
    });
    for (const row of rows) {
      if (row.email) suppressed.add(row.email.toLowerCase());
    }
  }

  return suppressed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupInternalLaunchIndex(now = Date.now()) {
  for (const [key, value] of internalCampaignLaunchIndex.entries()) {
    if (now - value.createdAt > INTERNAL_CAMPAIGN_IDEMPOTENCY_WINDOW_MS) {
      internalCampaignLaunchIndex.delete(key);
    }
  }
}

function buildCampaignSignature(params: {
  agentId: string;
  subject: string;
  htmlTemplate: string;
  recipients: string[];
  fromName: string;
  replyTo: string;
  utmCampaign?: string;
}) {
  const hash = crypto.createHash('sha256');
  hash.update(params.agentId);
  hash.update('\n');
  hash.update(params.subject.trim().toLowerCase());
  hash.update('\n');
  hash.update(params.fromName.trim().toLowerCase());
  hash.update('\n');
  hash.update(params.replyTo.trim().toLowerCase());
  hash.update('\n');
  hash.update((params.utmCampaign || '').trim().toLowerCase());
  hash.update('\n');
  hash.update(String(params.recipients.length));
  hash.update('\n');
  hash.update(params.recipients.join(','));
  hash.update('\n');
  hash.update(params.htmlTemplate);
  return hash.digest('hex');
}

async function runInternalCampaignJob(params: {
  campaignId: string;
  agentId: string;
  channelId: string;
  subject: string;
  htmlTemplate: string;
  recipients: string[];
  batchSize: number;
  throttleMs: number;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  utmCampaign?: string;
  suppressedRecipients: number;
}) {
  const job = internalCampaignJobs.get(params.campaignId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  const unsubscribeMailto = `mailto:${encodeURIComponent(params.replyTo)}?subject=${encodeURIComponent('Unsubscribe AgentEasePro Emails')}`;
  const unsubscribeUrl = `${process.env.PUBLIC_APP_URL || process.env.PUBLIC_API_BASE_URL || 'https://app.agenteasepro.com'}`;
  const asmGroupId = Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || 0);

  try {
    const chunks: string[][] = [];
    for (let i = 0; i < params.recipients.length; i += params.batchSize) {
      chunks.push(params.recipients.slice(i, i + params.batchSize));
    }

    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
      const batchRecipients = chunks[batchIndex];
      const result = await sendMarketingEmail({
        recipients: batchRecipients,
        subject: params.subject,
        htmlContent: params.htmlTemplate,
        fromEmail: params.fromEmail,
        fromName: params.fromName,
        replyTo: params.replyTo,
        unsubscribeUrl,
        categories: ['internal_campaign', 'sendgrid_owner_send'],
        headers: {
          'List-Unsubscribe': `<${unsubscribeMailto}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          Precedence: 'bulk',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
        customArgs: {
          agentId: params.agentId,
          blastId: params.campaignId,
          channelId: params.channelId,
          campaignType: 'internal_owner',
          ...(params.utmCampaign ? { utmCampaign: params.utmCampaign } : {}),
        },
        asm: asmGroupId > 0 ? { groupId: asmGroupId } : undefined,
      });

      await prisma.marketingDeliveryLog.create({
        data: {
          agentId: params.agentId,
          blastId: params.campaignId,
          channelId: params.channelId,
          provider: 'sendgrid',
          status: result.success ? 'SENT' : 'FAILED',
          messageId: result.messageId,
          subject: params.subject,
          recipientsCount: batchRecipients.length,
          recipientsSample: batchRecipients.slice(0, 12),
          audienceType: 'INTERNAL_UPLOAD',
          error: result.success ? null : result.error || 'SendGrid send failed',
        },
      });

      if (result.success) {
        job.sentRecipients += batchRecipients.length;
      } else {
        job.failedRecipients += batchRecipients.length;
        job.lastError = result.error || 'SendGrid send failed';
      }

      job.processedBatches += 1;
      job.updatedAt = new Date().toISOString();

      if (params.throttleMs > 0 && batchIndex < chunks.length - 1) {
        await sleep(params.throttleMs);
      }
    }

    await prisma.$transaction([
      prisma.blastChannel.update({
        where: { id: params.channelId },
        data: {
          status: job.sentRecipients > 0 ? BlastStatus.SENT : BlastStatus.DRAFT,
        },
      }),
      prisma.marketingBlast.update({
        where: { id: params.campaignId },
        data: {
          status: job.sentRecipients > 0 ? BlastStatus.SENT : BlastStatus.DRAFT,
          sentAt: job.sentRecipients > 0 ? new Date() : null,
          scheduledAt: null,
        },
      }),
    ]);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    job.suppressedRecipients = params.suppressedRecipients;
  } catch (error: any) {
    console.error('Internal campaign send failed', error);
    job.status = 'failed';
    job.lastError = error?.message || 'Internal campaign send failed';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    await prisma.marketingDeliveryLog.create({
      data: {
        agentId: params.agentId,
        blastId: params.campaignId,
        channelId: params.channelId,
        provider: 'sendgrid',
        status: 'FAILED',
        subject: params.subject,
        recipientsCount: 0,
        recipientsSample: [],
        audienceType: 'INTERNAL_UPLOAD',
        error: job.lastError,
      },
    });
  }
}

function normalizePath(path: string) {
  const clean = path.split('?')[0]?.trim().toLowerCase();
  return clean || '/';
}

function bucketFeature(path: string) {
  const clean = normalizePath(path);
  if (clean.startsWith('/internal')) return 'Internal';
  if (clean.startsWith('/dashboard')) return 'Dashboard';
  if (clean.startsWith('/leads')) return 'Leads';
  if (clean.startsWith('/clients')) return 'Clients';
  if (clean.startsWith('/deals')) return 'Deals';
  if (clean.startsWith('/tasks')) return 'Tasks';
  if (clean.startsWith('/calendar')) return 'Calendar';
  if (clean.startsWith('/listings')) return 'Listings';
  if (clean.startsWith('/marketing')) return 'Marketing';
  if (clean.startsWith('/reporting')) return 'Reporting';
  if (clean.startsWith('/settings')) return 'Settings';
  if (clean.startsWith('/contracts') || clean.startsWith('/repc') || clean.startsWith('/esign')) return 'Contracts';
  if (clean.startsWith('/landing')) return 'Landing Pages';
  if (clean.startsWith('/automations')) return 'Automations';
  if (clean.startsWith('/properties')) return 'Properties';
  return 'Other';
}

function parsePagination(req: { query: unknown }, res: { status: (code: number) => any; json: (body: any) => any }) {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid pagination', details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

router.get('/access', async (req: AuthenticatedRequest, res) => {
  const allowed = await isOwnerRequest(req);
  return res.json({
    allowed,
    configured: Boolean(process.env.AGENTEASE_OWNER_EMAIL || process.env.AGENTEASE_OWNER_ID),
  });
});

// Everything below requires owner
router.use(requireOwner);

router.post('/campaigns/preview', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = internalCampaignSchema.safeParse({
    ...req.body,
    dryRun: true,
    htmlTemplate: req.body?.htmlTemplate || '<div>preview</div>',
    subject: req.body?.subject || 'Preview',
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const extracted = extractEmails(parsed.data.recipientsRaw);
  const suppressed = await findSuppressedEmails(extracted.valid);
  const deliverable = extracted.valid.filter((email) => !suppressed.has(email));

  return res.json({
    totalParsed: extracted.valid.length,
    deliverableCount: deliverable.length,
    suppressedCount: suppressed.size,
    invalidCount: extracted.invalid.length,
    sampleDeliverable: deliverable.slice(0, 20),
    sampleSuppressed: Array.from(suppressed).slice(0, 20),
    sampleInvalid: extracted.invalid.slice(0, 20),
  });
});

router.post('/campaigns/send', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = internalCampaignSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const extracted = extractEmails(parsed.data.recipientsRaw);
  if (!extracted.valid.length) {
    return res.status(400).json({ error: 'No valid emails found in recipients list' });
  }

  const suppressed = await findSuppressedEmails(extracted.valid);
  const deliverable = extracted.valid.filter((email) => !suppressed.has(email));

  if (!deliverable.length) {
    return res.status(400).json({
      error: 'All parsed recipients are suppressed due to prior unsubscribes/bounces/spam reports',
      totalParsed: extracted.valid.length,
      suppressedCount: suppressed.size,
    });
  }

  if (deliverable.length > 25000) {
    return res.status(400).json({ error: 'Internal campaign recipient limit is 25,000 per send request' });
  }

  if (parsed.data.dryRun) {
    return res.json({
      dryRun: true,
      totalParsed: extracted.valid.length,
      deliverableCount: deliverable.length,
      suppressedCount: suppressed.size,
      invalidCount: extracted.invalid.length,
      sampleDeliverable: deliverable.slice(0, 20),
    });
  }

  const htmlTemplate = sanitizeCampaignHtml(parsed.data.htmlTemplate);
  const campaignTitle = parsed.data.campaignName || parsed.data.subject;
  const totalBatches = Math.ceil(deliverable.length / parsed.data.batchSize);
  const enforcedFromEmail = 'sales@agenteasepro.com';
  const replyTo = parsed.data.replyTo || enforcedFromEmail;

  cleanupInternalLaunchIndex();
  const signature = buildCampaignSignature({
    agentId: req.agentId,
    subject: parsed.data.subject,
    htmlTemplate,
    recipients: deliverable,
    fromName: parsed.data.fromName,
    replyTo,
    utmCampaign: parsed.data.utmCampaign,
  });

  const recentLaunch = internalCampaignLaunchIndex.get(signature);
  if (recentLaunch) {
    const existingRuntime = internalCampaignJobs.get(recentLaunch.campaignId);
    const blast = await prisma.marketingBlast.findFirst({
      where: {
        id: recentLaunch.campaignId,
        agentId: req.agentId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        sentAt: true,
      },
    });

    if (blast) {
      return res.status(202).json({
        queued: existingRuntime?.status === 'queued' || existingRuntime?.status === 'running',
        deduplicated: true,
        campaignId: blast.id,
        title: blast.title,
        blastStatus: blast.status,
        sentAt: blast.sentAt,
        runtimeStatus: existingRuntime?.status || null,
        message: 'Identical campaign already launched recently. Reusing existing campaign.',
      });
    }

    internalCampaignLaunchIndex.delete(signature);
  }

  const blast = await prisma.marketingBlast.create({
    data: {
      agentId: req.agentId,
      title: campaignTitle,
      playbook: BlastPlaybook.CUSTOM,
      status: BlastStatus.DRAFT,
      channels: {
        create: {
          channel: BlastChannelType.EMAIL,
          enabled: true,
          status: BlastStatus.DRAFT,
          previewText: parsed.data.subject,
          previewHtml: htmlTemplate,
        },
      },
    },
    include: { channels: true },
  });

  const emailChannel = blast.channels[0];

  internalCampaignJobs.set(blast.id, {
    campaignId: blast.id,
    status: 'queued',
    totalRecipients: deliverable.length,
    sentRecipients: 0,
    failedRecipients: 0,
    suppressedRecipients: suppressed.size,
    processedBatches: 0,
    totalBatches,
    subject: parsed.data.subject,
    updatedAt: new Date().toISOString(),
  });

  internalCampaignLaunchIndex.set(signature, {
    campaignId: blast.id,
    createdAt: Date.now(),
  });

  runInternalCampaignJob({
    campaignId: blast.id,
    agentId: req.agentId,
    channelId: emailChannel.id,
    subject: parsed.data.subject,
    htmlTemplate,
    recipients: deliverable,
    batchSize: parsed.data.batchSize,
    throttleMs: parsed.data.throttleMs,
    fromEmail: enforcedFromEmail,
    fromName: parsed.data.fromName,
    replyTo,
    utmCampaign: parsed.data.utmCampaign,
    suppressedRecipients: suppressed.size,
  }).catch((err) => {
    console.error('Internal campaign background start failed', err);
  });

  return res.status(202).json({
    queued: true,
    campaignId: blast.id,
    subject: parsed.data.subject,
    totalParsed: extracted.valid.length,
    deliverableCount: deliverable.length,
    suppressedCount: suppressed.size,
    invalidCount: extracted.invalid.length,
    batchSize: parsed.data.batchSize,
    totalBatches,
  });
});

router.get('/campaigns/:id/status', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const campaignId = req.params.id;
  const runtime = internalCampaignJobs.get(campaignId);

  const blast = await prisma.marketingBlast.findFirst({
    where: {
      id: campaignId,
      agentId: req.agentId,
    },
    include: {
      channels: {
        where: { channel: BlastChannelType.EMAIL },
        take: 1,
      },
    },
  });

  if (!blast) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const logs = await prisma.marketingDeliveryLog.findMany({
    where: {
      blastId: campaignId,
      agentId: req.agentId,
      audienceType: 'INTERNAL_UPLOAD',
    },
    orderBy: { createdAt: 'asc' },
  });

  const sentRecipients = logs
    .filter((log) => log.status === 'SENT')
    .reduce((sum, log) => sum + (log.recipientsCount || 0), 0);
  const failedRecipients = logs
    .filter((log) => log.status === 'FAILED')
    .reduce((sum, log) => sum + (log.recipientsCount || 0), 0);

  return res.json({
    campaignId,
    title: blast.title,
    blastStatus: blast.status,
    sentAt: blast.sentAt,
    runtime,
    aggregate: {
      batchesProcessed: logs.length,
      sentRecipients,
      failedRecipients,
      recentFailures: logs.filter((log) => log.status === 'FAILED').slice(-5).map((log) => ({
        at: log.createdAt,
        error: log.error,
        recipientsCount: log.recipientsCount,
      })),
    },
  });
});

router.get('/overview', async (_req, res) => {
  const [
    totalAgents,
    totalClients,
    totalDeals,
    totalListings,
    totalTasks,
    totalBlasts,
    totalEnvelopes,
  ] = await Promise.all([
    prisma.agent.count({ where: { status: { not: 'REVOKED' } } }),
    prisma.client.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
    prisma.deal.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
    prisma.listing.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
    prisma.task.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
    prisma.marketingBlast.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
    prisma.signatureEnvelope.count({ where: { deal: { agent: { status: { not: 'REVOKED' } } } } }),
  ]);

  const [recentAgents, recentDeals, recentListings, recentTasks] = await Promise.all([
    prisma.agent.findMany({
      where: { status: { not: 'REVOKED' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, email: true, name: true, brokerageName: true, createdAt: true },
    }),
    prisma.deal.findMany({
      where: { agent: { status: { not: 'REVOKED' } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        agentId: true,
        createdAt: true,
        agent: { select: { name: true, email: true } },
      },
    }),
    prisma.listing.findMany({
      where: { agent: { status: { not: 'REVOKED' } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        headline: true,
        status: true,
        price: true,
        city: true,
        agentId: true,
        createdAt: true,
        agent: { select: { name: true, email: true } },
      },
    }),
    prisma.task.findMany({
      where: { agent: { status: { not: 'REVOKED' } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        agentId: true,
        createdAt: true,
        agent: { select: { name: true, email: true } },
      },
    }),
  ]);

  return res.json({
    totals: {
      agents: totalAgents,
      clients: totalClients,
      deals: totalDeals,
      listings: totalListings,
      tasks: totalTasks,
      marketingBlasts: totalBlasts,
      signatureEnvelopes: totalEnvelopes,
    },
    recent: {
      agents: recentAgents,
      deals: recentDeals,
      listings: recentListings,
      tasks: recentTasks,
    },
  });
});

router.get('/calculations/heroku-pricing', async (_req, res) => {
  try {
    const snapshot = await fetchHerokuPricingSnapshot();
    return res.json(snapshot);
  } catch (err: any) {
    console.error('Failed to fetch Heroku pricing snapshot:', err);
    return res.status(502).json({
      error: 'Failed to fetch Heroku pricing snapshot',
      message: err?.message || 'Unknown error while fetching Heroku pricing',
    });
  }
});

router.get('/agents', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const { q } = searchSchema.parse(req.query);
  const view = z.enum(['active', 'archived', 'all']).optional().parse(req.query.view);
  const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
  const resolvedView = view || (includeArchived ? 'all' : 'active');

  const statusFilter: Prisma.AgentWhereInput =
    resolvedView === 'archived'
      ? { status: 'REVOKED' }
      : resolvedView === 'all'
        ? {}
        : { status: { not: 'REVOKED' } };

  const where: Prisma.AgentWhereInput = {
    ...statusFilter,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { brokerageName: { contains: q, mode: 'insensitive' } },
            { licenseNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, agents] = await Promise.all([
    prisma.agent.count({ where }),
    prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        brokerageName: true,
        licenseNumber: true,
        status: true,
        subscriptionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return res.json({
    page,
    pageSize,
    total,
    includeArchived,
    view: resolvedView,
    agents,
  });
});

router.post('/agents/bulk-status', async (req: AuthenticatedRequest, res) => {
  const body = z
    .object({
      agentIds: z.array(z.string().uuid()).min(1).max(200),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']),
    })
    .parse(req.body || {});

  const uniqueIds = Array.from(new Set(body.agentIds));
  if (req.user?.id && uniqueIds.includes(req.user.id)) {
    return res.status(400).json({ error: 'Cannot change your own status in bulk action' });
  }

  const result = await prisma.agent.updateMany({
    where: { id: { in: uniqueIds } },
    data: { status: body.status },
  });

  return res.json({
    updated: result.count,
    status: body.status,
  });
});

router.get('/agents/:id', async (req, res) => {
  const id = req.params.id;

  const agent = await prisma.agent.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      brokerageName: true,
      licenseNumber: true,
      createdAt: true,
      updatedAt: true,
      profileSettings: true,
      notificationPrefs: true,
      aiSettings: true,
      idxConnection: true,
      googleCalendar: true,
      status: true,
      subscriptionStatus: true,
      billingAccessOverride: true,
      _count: {
        select: {
          clients: true,
          deals: true,
          listings: true,
          tasks: true,
          marketingBlasts: true,
          landingPages: true,
          leads: true,
        },
      },
    },
  });

  if (!agent) return res.status(404).json({ error: 'Not found' });

  const [latestDeals, latestListings, latestTasks, latestEnvelopes] = await Promise.all([
    prisma.deal.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
    }),
    prisma.listing.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, headline: true, status: true, price: true, city: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, status: true, priority: true, createdAt: true, dueAt: true },
    }),
    prisma.signatureEnvelope.findMany({
      where: { deal: { agentId: id } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, type: true, createdAt: true, dealId: true },
    }),
  ]);

  return res.json({ agent, latest: { deals: latestDeals, listings: latestListings, tasks: latestTasks, envelopes: latestEnvelopes } });
});

router.post('/agents/:id/status', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const status = z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).parse(req.body.status);
  
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Cannot change your own status' });
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: { status },
    select: { id: true, status: true }
  });
  
  return res.json(agent);
});

router.post('/agents/:id/subscription', async (req, res) => {
  const { id } = req.params;
  const body = z
    .object({
      status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
      billingAccessOverride: z.boolean().optional(),
    })
    .refine((value) => typeof value.status !== 'undefined' || typeof value.billingAccessOverride === 'boolean', {
      message: 'Provide status and/or billingAccessOverride',
    })
    .parse(req.body || {});

  const data: any = {};
  if (body.status) data.subscriptionStatus = body.status;
  if (typeof body.billingAccessOverride === 'boolean') data.billingAccessOverride = body.billingAccessOverride;
  
  const agent = await prisma.agent.update({
    where: { id },
    data,
    select: { id: true, subscriptionStatus: true, billingAccessOverride: true }
  });
  
  return res.json(agent);
});

router.get('/legal/policies', async (_req, res) => {
  try {
    const policies = await getLegalPolicies();
    return res.json(policies);
  } catch (err) {
    console.error('Failed to load internal legal policies:', err);
    return res.status(500).json({ error: 'Failed to load legal policies' });
  }
});

router.put('/legal/policies', async (req: AuthenticatedRequest, res) => {
  try {
    const body = z
      .object({
        terms: z.object({
          url: z.string().trim().min(1).max(500),
          version: z.string().trim().min(1).max(64),
        }),
        privacy: z.object({
          url: z.string().trim().min(1).max(500),
          version: z.string().trim().min(1).max(64),
        }),
      })
      .parse(req.body || {});

    const updated = await updateLegalPolicies(body as any, {
      id: req.user?.id,
      name: req.user?.name,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Failed to update internal legal policies:', err);
    return res.status(400).json({ error: 'Failed to update legal policies' });
  }
});

router.get('/agents/:id/activity', async (req, res) => {
  const { id } = req.params;
  const activities = await prisma.dailyActivity.findMany({
    where: { agentId: id },
    orderBy: { date: 'desc' },
    take: 30
  });
  return res.json(activities);
});

router.get('/telemetry/events', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const q = z
    .object({
      agentId: z.string().trim().optional(),
      kind: z.string().trim().max(64).optional(),
      search: z.string().trim().max(120).optional(),
    })
    .parse(req.query);

  const where: Prisma.InternalEventWhereInput = {
    ...(q.agentId ? { agentId: q.agentId } : {}),
    ...(q.kind ? { kind: q.kind } : {}),
    ...(q.search
      ? {
          OR: [
            { path: { contains: q.search, mode: 'insensitive' } },
            { kind: { contains: q.search, mode: 'insensitive' } },
            { agent: { name: { contains: q.search, mode: 'insensitive' } } },
            { agent: { email: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, events] = await Promise.all([
    prisma.internalEvent.count({ where }),
    prisma.internalEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        kind: true,
        path: true,
        agent: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return res.json({ page, pageSize, total, events });
});

router.get('/telemetry/errors', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const q = z
    .object({
      agentId: z.string().trim().optional(),
      source: z.enum(['client', 'server']).optional(),
      search: z.string().trim().max(120).optional(),
    })
    .parse(req.query);

  const where: Prisma.InternalErrorWhereInput = {
    ...(q.agentId ? { agentId: q.agentId } : {}),
    ...(q.source ? { source: q.source } : {}),
    ...(q.search
      ? {
          OR: [
            { message: { contains: q.search, mode: 'insensitive' } },
            { path: { contains: q.search, mode: 'insensitive' } },
            { agent: { name: { contains: q.search, mode: 'insensitive' } } },
            { agent: { email: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, errors] = await Promise.all([
    prisma.internalError.count({ where }),
    prisma.internalError.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        source: true,
        message: true,
        path: true,
        agent: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return res.json({ page, pageSize, total, errors });
});

router.get('/telemetry/summary', async (req, res) => {
  const q = z
    .object({
      agentId: z.string().trim().optional(),
    })
    .parse(req.query);

  const hours = Math.min(Math.max(Number(req.query.hours || 24), 1), 168);
  const now = Date.now();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const previousSince = new Date(now - hours * 2 * 60 * 60 * 1000);
  const previousUntil = since;

  const eventWhereCurrent: Prisma.InternalEventWhereInput = {
    createdAt: { gte: since },
    ...(q.agentId
      ? { agentId: q.agentId }
      : {
          OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
        }),
  };
  const eventWherePrevious: Prisma.InternalEventWhereInput = {
    createdAt: { gte: previousSince, lt: previousUntil },
    ...(q.agentId
      ? { agentId: q.agentId }
      : {
          OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
        }),
  };

  const errorWhereCurrent: Prisma.InternalErrorWhereInput = {
    createdAt: { gte: since },
    ...(q.agentId
      ? { agentId: q.agentId }
      : {
          OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
        }),
  };
  const errorWherePrevious: Prisma.InternalErrorWhereInput = {
    createdAt: { gte: previousSince, lt: previousUntil },
    ...(q.agentId
      ? { agentId: q.agentId }
      : {
          OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
        }),
  };

  const deltaPct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const [
    eventCount,
    previousEventCount,
    errorCount,
    previousErrorCount,
    agentsCount,
    previousAgentsCount,
    eventKinds,
    errorSources,
    totalAgents,
    newAgents30d,
    previousNewAgents30d,
    revenueCurrentAgg,
    revenuePreviousAgg,
  ] = await Promise.all([
    prisma.internalEvent.count({ where: eventWhereCurrent }),
    prisma.internalEvent.count({ where: eventWherePrevious }),
    prisma.internalError.count({ where: errorWhereCurrent }),
    prisma.internalError.count({ where: errorWherePrevious }),
    prisma.internalEvent.findMany({
      where: {
        createdAt: { gte: since },
        agentId: { not: null },
        ...(q.agentId ? { agentId: q.agentId } : { agent: { status: { not: 'REVOKED' } } }),
      },
      distinct: ['agentId'],
      select: { agentId: true },
    }),
    prisma.internalEvent.findMany({
      where: {
        createdAt: { gte: previousSince, lt: previousUntil },
        agentId: { not: null },
        ...(q.agentId ? { agentId: q.agentId } : { agent: { status: { not: 'REVOKED' } } }),
      },
      distinct: ['agentId'],
      select: { agentId: true },
    }),
    prisma.internalEvent.groupBy({
      by: ['kind'],
      where: eventWhereCurrent,
      _count: { kind: true },
    }),
    prisma.internalError.groupBy({
      by: ['source'],
      where: errorWhereCurrent,
      _count: { source: true },
    }),
    prisma.agent.count({ where: { status: { not: 'REVOKED' } } }),
    prisma.agent.count({ where: { status: { not: 'REVOKED' }, createdAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.agent.count({
      where: {
        status: { not: 'REVOKED' },
        createdAt: {
          gte: new Date(now - 60 * 24 * 60 * 60 * 1000),
          lt: new Date(now - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          closedAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
          ...(q.agentId ? { agentId: q.agentId } : { agent: { status: { not: 'REVOKED' } } }),
        },
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          closedAt: {
            gte: new Date(now - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(now - 30 * 24 * 60 * 60 * 1000),
          },
          ...(q.agentId ? { agentId: q.agentId } : { agent: { status: { not: 'REVOKED' } } }),
        },
      },
    }),
  ]);

  const revenueCurrent = Number(revenueCurrentAgg._sum.purchasePrice || 0);
  const revenuePrevious = Number(revenuePreviousAgg._sum.purchasePrice || 0);

  const eventsDelta = eventCount - previousEventCount;
  const errorsDelta = errorCount - previousErrorCount;
  const activeAgentsDelta = agentsCount.length - previousAgentsCount.length;
  const agentGrowthDelta = newAgents30d - previousNewAgents30d;

  res.json({
    hours,
    events: eventCount,
    eventsChange: {
      previous: previousEventCount,
      delta: eventsDelta,
      deltaPct: deltaPct(eventCount, previousEventCount),
    },
    errors: errorCount,
    errorsChange: {
      previous: previousErrorCount,
      delta: errorsDelta,
      deltaPct: deltaPct(errorCount, previousErrorCount),
    },
    agentsActive: agentsCount.length,
    agentsActiveChange: {
      previous: previousAgentsCount.length,
      delta: activeAgentsDelta,
      deltaPct: deltaPct(agentsCount.length, previousAgentsCount.length),
    },
    totalAgents,
    revenue30d: {
      current: revenueCurrent,
      previous: revenuePrevious,
      delta: revenueCurrent - revenuePrevious,
      deltaPct: deltaPct(revenueCurrent, revenuePrevious),
    },
    agentGrowth30d: {
      current: newAgents30d,
      previous: previousNewAgents30d,
      delta: agentGrowthDelta,
      deltaPct: deltaPct(newAgents30d, previousNewAgents30d),
    },
    topEventKinds: eventKinds
      .map((k) => ({ kind: k.kind, count: k._count.kind }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    errorSources: errorSources.map((s) => ({ source: s.source, count: s._count.source })),
  });
});

router.get('/telemetry/activity-graph', async (req, res) => {
  const q = z
    .object({
      agentId: z.string().trim().optional(),
      days: z.coerce.number().int().min(7).max(365).default(30),
    })
    .parse(req.query);

  const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000);

  const eventRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint | number }>>(Prisma.sql`
    SELECT DATE(ie."createdAt") AS date, COUNT(*)::bigint AS count
    FROM "InternalEvent" ie
    WHERE ie."createdAt" >= ${since}
    ${q.agentId ? Prisma.sql`AND ie."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND (ie."agentId" IS NULL OR EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = ie."agentId" AND a."status" <> 'REVOKED'))`}
    GROUP BY DATE(ie."createdAt")
    ORDER BY date ASC
  `);

  const errorRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint | number }>>(Prisma.sql`
    SELECT DATE(ie."createdAt") AS date, COUNT(*)::bigint AS count
    FROM "InternalError" ie
    WHERE ie."createdAt" >= ${since}
    ${q.agentId ? Prisma.sql`AND ie."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND (ie."agentId" IS NULL OR EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = ie."agentId" AND a."status" <> 'REVOKED'))`}
    GROUP BY DATE(ie."createdAt")
    ORDER BY date ASC
  `);

  const webViewRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint | number }>>(Prisma.sql`
    SELECT DATE(pv."createdAt") AS date, COUNT(*)::bigint AS count
    FROM "PageView" pv
    ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
    WHERE pv."createdAt" >= ${since}
    ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
    GROUP BY DATE(pv."createdAt")
    ORDER BY date ASC
  `);

  const webVisitorRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint | number }>>(Prisma.sql`
    SELECT DATE(pv."createdAt") AS date, COUNT(DISTINCT pv."visitorId")::bigint AS count
    FROM "PageView" pv
    ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
    WHERE pv."createdAt" >= ${since}
    ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
    GROUP BY DATE(pv."createdAt")
    ORDER BY date ASC
  `);

  const activeAgentRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint | number }>>(Prisma.sql`
    SELECT DATE(ie."createdAt") AS date, COUNT(DISTINCT ie."agentId")::bigint AS count
    FROM "InternalEvent" ie
    WHERE ie."createdAt" >= ${since}
      AND ie."agentId" IS NOT NULL
    ${q.agentId ? Prisma.sql`AND ie."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = ie."agentId" AND a."status" <> 'REVOKED')`}
    GROUP BY DATE(ie."createdAt")
    ORDER BY date ASC
  `);

  const revenueRows = await prisma.$queryRaw<Array<{ date: Date; value: unknown }>>(Prisma.sql`
    SELECT DATE(d."closedAt") AS date, COALESCE(SUM(r."purchasePrice"), 0) AS value
    FROM "Repc" r
    INNER JOIN "Deal" d ON d."id" = r."dealId"
    WHERE d."closedAt" IS NOT NULL
      AND d."status" = 'CLOSED'
      AND d."closedAt" >= ${since}
      ${q.agentId ? Prisma.sql`AND d."agentId" = ${q.agentId}` : Prisma.empty}
      ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = d."agentId" AND a."status" <> 'REVOKED')`}
    GROUP BY DATE(d."closedAt")
    ORDER BY date ASC
  `);

  const eventMap = new Map(eventRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.count || 0)]));
  const errorMap = new Map(errorRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.count || 0)]));
  const webViewMap = new Map(webViewRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.count || 0)]));
  const webVisitorMap = new Map(webVisitorRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.count || 0)]));
  const activeAgentMap = new Map(activeAgentRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.count || 0)]));
  const revenueMap = new Map(
    revenueRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.value || 0)]),
  );

  const points: Array<{
    date: string;
    events: number;
    errors: number;
    webViews: number;
    webVisitors: number;
    activeAgents: number;
    revenue: number;
  }> = [];

  for (let i = q.days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    points.push({
      date: key,
      events: eventMap.get(key) || 0,
      errors: errorMap.get(key) || 0,
      webViews: webViewMap.get(key) || 0,
      webVisitors: webVisitorMap.get(key) || 0,
      activeAgents: activeAgentMap.get(key) || 0,
      revenue: revenueMap.get(key) || 0,
    });
  }

  const totals = points.reduce(
    (acc, item) => {
      acc.events += item.events;
      acc.errors += item.errors;
      acc.webViews += item.webViews;
      acc.webVisitors += item.webVisitors;
      acc.activeAgents += item.activeAgents;
      acc.revenue += item.revenue;
      return acc;
    },
    { events: 0, errors: 0, webViews: 0, webVisitors: 0, activeAgents: 0, revenue: 0 },
  );

  return res.json({
    days: q.days,
    points,
    totals,
  });
});

router.get('/telemetry/website', async (req, res) => {
  const q = z
    .object({
      agentId: z.string().trim().optional(),
      days: z.coerce.number().int().min(1).max(365).default(30),
    })
    .parse(req.query);

  const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000);
  const previousSince = new Date(Date.now() - q.days * 2 * 24 * 60 * 60 * 1000);
  const previousUntil = since;
  const websiteLeadSources = ['WEBSITE', 'LANDING_PAGE'] as const;

  const pageViewWhereAll: Prisma.PageViewWhereInput = {
    ...(q.agentId ? { landingPage: { agentId: q.agentId } } : { landingPage: { agent: { status: { not: 'REVOKED' } } } }),
  };

  const pageViewWhereRange: Prisma.PageViewWhereInput = {
    ...pageViewWhereAll,
    createdAt: { gte: since },
  };

  const leadWhereAll: Prisma.LeadWhereInput = {
    source: { in: websiteLeadSources as unknown as any[] },
    ...(q.agentId ? { agentId: q.agentId } : { agent: { status: { not: 'REVOKED' } } }),
  };

  const leadWhereRange: Prisma.LeadWhereInput = {
    ...leadWhereAll,
    createdAt: { gte: since },
  };

  const pageViewWherePrevious: Prisma.PageViewWhereInput = {
    ...pageViewWhereAll,
    createdAt: { gte: previousSince, lt: previousUntil },
  };

  const leadWherePrevious: Prisma.LeadWhereInput = {
    ...leadWhereAll,
    createdAt: { gte: previousSince, lt: previousUntil },
  };

  const distinctAllQuery = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT pv."visitorId")::bigint AS count
    FROM "PageView" pv
    ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
    WHERE 1 = 1
    ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
  `);

  const distinctRangeQuery = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT pv."visitorId")::bigint AS count
    FROM "PageView" pv
    ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
    WHERE pv."createdAt" >= ${since}
    ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
  `);

  const distinctPreviousQuery = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT pv."visitorId")::bigint AS count
    FROM "PageView" pv
    ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
    WHERE pv."createdAt" >= ${previousSince}
      AND pv."createdAt" < ${previousUntil}
    ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
    ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
  `);

  const [
    allTimeViews,
    allTimeLeads,
    rangeViews,
    rangeLeads,
    previousViews,
    previousLeads,
    sourceRows,
    campaignRows,
    deviceRows,
    topLandingRows,
    dailyViewRows,
    dailyLeadRows,
  ] = await Promise.all([
    prisma.pageView.count({ where: pageViewWhereAll }),
    prisma.lead.count({ where: leadWhereAll }),
    prisma.pageView.count({ where: pageViewWhereRange }),
    prisma.lead.count({ where: leadWhereRange }),
    prisma.pageView.count({ where: pageViewWherePrevious }),
    prisma.lead.count({ where: leadWherePrevious }),
    prisma.pageView.groupBy({
      by: ['utmSource'],
      where: { ...pageViewWhereRange, utmSource: { not: null } },
      _count: { utmSource: true },
      orderBy: { _count: { utmSource: 'desc' } },
      take: 8,
    }),
    prisma.pageView.groupBy({
      by: ['utmCampaign'],
      where: { ...pageViewWhereRange, utmCampaign: { not: null } },
      _count: { utmCampaign: true },
      orderBy: { _count: { utmCampaign: 'desc' } },
      take: 8,
    }),
    prisma.pageView.groupBy({
      by: ['device'],
      where: { ...pageViewWhereRange, device: { not: null } },
      _count: { device: true },
      orderBy: { _count: { device: 'desc' } },
      take: 8,
    }),
    prisma.pageView.groupBy({
      by: ['landingPageId'],
      where: { ...pageViewWhereRange, landingPageId: { not: null } },
      _count: { landingPageId: true },
      orderBy: { _count: { landingPageId: 'desc' } },
      take: 8,
    }),
    prisma.$queryRaw<Array<{ date: Date; views: bigint | number }>>(Prisma.sql`
      SELECT DATE(pv."createdAt") AS date, COUNT(*)::bigint AS views
      FROM "PageView" pv
      ${q.agentId ? Prisma.sql`INNER JOIN "LandingPage" lp ON lp."id" = pv."landingPageId"` : Prisma.empty}
      WHERE pv."createdAt" >= ${since}
      ${q.agentId ? Prisma.sql`AND lp."agentId" = ${q.agentId}` : Prisma.empty}
      ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "LandingPage" lp2 INNER JOIN "Agent" a ON a."id" = lp2."agentId" WHERE lp2."id" = pv."landingPageId" AND a."status" <> 'REVOKED')`}
      GROUP BY DATE(pv."createdAt")
      ORDER BY date ASC
    `),
    prisma.$queryRaw<Array<{ date: Date; leads: bigint | number }>>(Prisma.sql`
      SELECT DATE(l."createdAt") AS date, COUNT(*)::bigint AS leads
      FROM "Lead" l
      WHERE l."createdAt" >= ${since}
        AND l."source" IN ('WEBSITE', 'LANDING_PAGE')
      ${q.agentId ? Prisma.sql`AND l."agentId" = ${q.agentId}` : Prisma.empty}
      ${q.agentId ? Prisma.empty : Prisma.sql`AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = l."agentId" AND a."status" <> 'REVOKED')`}
      GROUP BY DATE(l."createdAt")
      ORDER BY date ASC
    `),
  ]);

  const allTimeUniqueVisitors = Number(distinctAllQuery[0]?.count || 0);
  const rangeUniqueVisitors = Number(distinctRangeQuery[0]?.count || 0);
  const previousUniqueVisitors = Number(distinctPreviousQuery[0]?.count || 0);

  const topLandingIds = topLandingRows
    .map((row) => row.landingPageId)
    .filter((id): id is string => Boolean(id));

  const [landingPages, leadsByLandingPage] = await Promise.all([
    topLandingIds.length
      ? prisma.landingPage.findMany({
          where: { id: { in: topLandingIds } },
          select: { id: true, title: true, slug: true },
        })
      : Promise.resolve([]),
    topLandingIds.length
      ? prisma.lead.groupBy({
          by: ['landingPageId'],
          where: {
            ...leadWhereRange,
            landingPageId: { in: topLandingIds },
          },
          _count: { landingPageId: true },
        })
      : Promise.resolve([]),
  ]);

  const pageMap = new Map(landingPages.map((page) => [page.id, page]));
  const leadsByPageMap = new Map(
    leadsByLandingPage
      .filter((row) => row.landingPageId)
      .map((row) => [row.landingPageId as string, row._count.landingPageId]),
  );

  const dailyViewMap = new Map(
    dailyViewRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.views || 0)]),
  );
  const dailyLeadMap = new Map(
    dailyLeadRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), Number(row.leads || 0)]),
  );

  const daily: Array<{ date: string; views: number; leads: number }> = [];
  for (let i = q.days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    daily.push({
      date: key,
      views: dailyViewMap.get(key) || 0,
      leads: dailyLeadMap.get(key) || 0,
    });
  }

  const allTimeConversionRate = allTimeViews > 0 ? (allTimeLeads / allTimeViews) * 100 : 0;
  const rangeConversionRate = rangeViews > 0 ? (rangeLeads / rangeViews) * 100 : 0;

  return res.json({
    days: q.days,
    allTime: {
      views: allTimeViews,
      uniqueVisitors: allTimeUniqueVisitors,
      leads: allTimeLeads,
      conversionRate: Number(allTimeConversionRate.toFixed(2)),
    },
    range: {
      views: rangeViews,
      uniqueVisitors: rangeUniqueVisitors,
      leads: rangeLeads,
      conversionRate: Number(rangeConversionRate.toFixed(2)),
    },
    previousRange: {
      views: previousViews,
      uniqueVisitors: previousUniqueVisitors,
      leads: previousLeads,
      conversionRate: Number((previousViews > 0 ? (previousLeads / previousViews) * 100 : 0).toFixed(2)),
    },
    daily,
    topSources: sourceRows
      .filter((row) => row.utmSource)
      .map((row) => ({ source: row.utmSource as string, count: row._count.utmSource })),
    topCampaigns: campaignRows
      .filter((row) => row.utmCampaign)
      .map((row) => ({ campaign: row.utmCampaign as string, count: row._count.utmCampaign })),
    devices: deviceRows
      .filter((row) => row.device)
      .map((row) => ({ device: row.device as string, count: row._count.device })),
    topLandingPages: topLandingRows
      .filter((row) => row.landingPageId)
      .map((row) => {
        const id = row.landingPageId as string;
        const page = pageMap.get(id);
        return {
          landingPageId: id,
          slug: page?.slug || null,
          title: page?.title || 'Unknown page',
          views: row._count.landingPageId,
          leads: leadsByPageMap.get(id) || 0,
        };
      }),
  });
});

router.get('/usage', async (req, res) => {
  const hours = Math.min(Math.max(Number(req.query.hours || 168), 1), 720);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [eventsCount, pageViewsCount, errorsCount] = await Promise.all([
    prisma.internalEvent.count({
      where: {
        createdAt: { gte: since },
        OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
      },
    }),
    prisma.internalEvent.count({
      where: {
        createdAt: { gte: since },
        kind: 'page_view',
        OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
      },
    }),
    prisma.internalError.count({
      where: {
        createdAt: { gte: since },
        OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
      },
    }),
  ]);

  const [active24, active7, active30] = await Promise.all([
    prisma.internalEvent.groupBy({
      by: ['agentId'],
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        agentId: { not: null },
        agent: { status: { not: 'REVOKED' } },
      },
      _count: { agentId: true },
    }),
    prisma.internalEvent.groupBy({
      by: ['agentId'],
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        agentId: { not: null },
        agent: { status: { not: 'REVOKED' } },
      },
      _count: { agentId: true },
    }),
    prisma.internalEvent.groupBy({
      by: ['agentId'],
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        agentId: { not: null },
        agent: { status: { not: 'REVOKED' } },
      },
      _count: { agentId: true },
    }),
  ]);

  const topAgentRows = await (prisma.internalEvent.groupBy as any)({
    by: ['agentId'],
    where: {
      createdAt: { gte: since },
      kind: 'page_view',
      agentId: { not: null },
      agent: { status: { not: 'REVOKED' } },
    },
    _count: { agentId: true },
    orderBy: { _count: { agentId: 'desc' } },
    take: 8,
  });

  const agentIds = topAgentRows.map((row) => row.agentId).filter(Boolean) as string[];
  const agents = agentIds.length
    ? await prisma.agent.findMany({
        where: { id: { in: agentIds }, status: { not: 'REVOKED' } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

  const topAgents = topAgentRows
    .map((row) => ({
      agentId: row.agentId,
      views: row._count.agentId,
      agent: row.agentId ? agentMap.get(row.agentId) || null : null,
    }))
    .filter((row) => row.agentId);

  const pageGroups = await prisma.internalEvent.groupBy({
    by: ['path'],
    where: {
      createdAt: { gte: since },
      kind: 'page_view',
      path: { not: null },
      OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
    },
    _count: { path: true },
    orderBy: { _count: { path: 'desc' } },
    take: 200,
  });

  const topPages = pageGroups.slice(0, 12).map((row) => ({
    path: row.path || '/',
    count: row._count.path,
  }));

  const featureMap = new Map<string, number>();
  pageGroups.forEach((row) => {
    if (!row.path) return;
    const feature = bucketFeature(row.path);
    featureMap.set(feature, (featureMap.get(feature) || 0) + row._count.path);
  });

  const featureUsage = Array.from(featureMap.entries())
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const trendEvents = await prisma.internalEvent.findMany({
    where: {
      createdAt: { gte: since },
      kind: 'page_view',
      OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const trendMap = new Map<string, number>();
  for (const row of trendEvents) {
    const key = row.createdAt.toISOString().slice(0, 10);
    trendMap.set(key, (trendMap.get(key) || 0) + 1);
  }

  const days = Math.max(1, Math.ceil(hours / 24));
  const trend: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    trend.push({ date: key, count: trendMap.get(key) || 0 });
  }

  res.json({
    hours,
    events: eventsCount,
    pageViews: pageViewsCount,
    errors: errorsCount,
    activeAgents: {
      last24h: active24.length,
      last7d: active7.length,
      last30d: active30.length,
    },
    topAgents,
    topPages,
    featureUsage,
    trend,
    sampled: pageViewsCount > trendEvents.length,
  });
});

router.get('/listings', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const status = z.string().trim().optional().parse(req.query.status);
  const q = z.string().trim().max(120).optional().parse(req.query.q);

  const where: Prisma.ListingWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(q
      ? {
          OR: [
            { headline: { contains: q, mode: 'insensitive' } },
            { addressLine1: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { zipCode: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        headline: true,
        status: true,
        price: true,
        addressLine1: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        agent: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return res.json({ page, pageSize, total, listings });
});

router.get('/contracts', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;

  const [total, envelopes] = await Promise.all([
    prisma.signatureEnvelope.count(),
    prisma.signatureEnvelope.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        createdAt: true,
        dealId: true,
        deal: {
          select: {
            title: true,
            status: true,
            agentId: true,
            agent: { select: { name: true, email: true } },
          },
        },
        signers: { select: { id: true, role: true, signedAt: true } },
      },
    }),
  ]);

  const rows = envelopes.map((env) => {
    const totalSigners = env.signers.length;
    const signed = env.signers.filter((s) => Boolean(s.signedAt)).length;
    return {
      id: env.id,
      type: env.type,
      createdAt: env.createdAt,
      dealId: env.dealId,
      dealTitle: env.deal?.title || '—',
      dealStatus: env.deal?.status || '—',
      agent: env.deal?.agent || null,
      signerStats: { total: totalSigners, signed },
    };
  });

  return res.json({ page, pageSize, total, contracts: rows });
});

router.get('/system', async (_req, res) => {
  let packageJson = { version: 'unknown', name: 'AgentEasePro' };
  try {
     packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
  } catch {}
  const start = performance.now();
  let dbOk = false;
  let dbLatency = 0;
  
  try {
    const dbStart = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Math.round(performance.now() - dbStart);
    dbOk = true;
  } catch (err: any) {
    dbOk = false;
    console.error('DB Health Check Failed:', err.message);
  }

  // System Stats
  const memUsage = process.memoryUsage();
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMem: Math.round(os.totalmem() / 1024 / 1024),
    freeMem: Math.round(os.freemem() / 1024 / 1024),
    uptime: Math.round(os.uptime()),
    loadAvg: os.loadavg(),
  };

  const processInfo = {
    pid: process.pid,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    }
  };

  // Environment Checks
  const envChecks = {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: Boolean(process.env.DATABASE_URL),
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripePublic: Boolean(
      process.env.STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLIC_KEY ||
      process.env.VITE_STRIPE_PUBLIC_KEY
    ),
    idxApi: Boolean(process.env.IDX_API_KEY),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    sendgridKey: Boolean(process.env.SENDGRID_API_KEY),
    jwtSecret: Boolean(process.env.JWT_SECRET),
  };

  let agentCount = 0;
  let clientCount = 0;
  let dealCount = 0;
  let listingCount = 0;
  let supportOpen = 0;
  let errors24h = 0;
  let recentErrors: Array<{
    id: string;
    createdAt: Date;
    message: string;
    path: string | null;
    source: 'client' | 'server';
  }> = [];

  if (dbOk) {
    try {
      [agentCount, clientCount, dealCount, listingCount, supportOpen, errors24h] = await Promise.all([
        prisma.agent.count({ where: { status: { not: 'REVOKED' } } }),
        prisma.client.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
        prisma.deal.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
        prisma.listing.count({ where: { agent: { status: { not: 'REVOKED' } } } }),
        prisma.supportRequest.count({ where: { status: 'OPEN', agent: { status: { not: 'REVOKED' } } } }),
        prisma.internalError.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
          }
        }),
      ]);

      const recentErrorsRaw = await prisma.internalError.findMany({
        where: {
          OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          message: true,
          path: true,
          source: true,
        },
      });

      recentErrors = recentErrorsRaw.map((item) => ({
        ...item,
        source: item.source === 'server' ? 'server' : 'client',
      }));
    } catch (err: any) {
      dbOk = false;
      dbLatency = 0;
      console.error('System stats query failed:', err?.message || err);
    }
  }

  const duration = Math.round(performance.now() - start);

  return res.json({
    status: dbOk ? 'healthy' : 'degraded',
    app: {
      version: packageJson.version,
      name: packageJson.name,
      environment: process.env.NODE_ENV
    },
    system: systemInfo,
    process: processInfo,
    database: {
      ok: dbOk,
      latencyMs: dbLatency,
      counts: {
        agents: agentCount,
        clients: clientCount,
        deals: dealCount,
        listings: listingCount,
        supportTickets: supportOpen
      }
    },
    integrations: envChecks,
    errors: {
      last24h: errors24h,
      recent: recentErrors
    },
    meta: {
      responseTimeMs: duration,
      serverTime: new Date().toISOString()
    }
  });
});

router.get('/billing/overview', async (_req, res) => {
  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const previous30Start = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const previous30End = since30;
  const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const [agents, closedVolume30Agg, closedVolumePrev30Agg, closedVolume90Agg, closedVolumeAllTimeAgg, closedDeals30] = await Promise.all([
    prisma.agent.findMany({
      where: { status: { not: 'REVOKED' } },
      select: {
        id: true,
        name: true,
        email: true,
        billingMode: true,
        billingCustomPriceCents: true,
        subscriptionStatus: true,
        billingAccessOverride: true,
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          closedAt: { gte: since30 },
          agent: { status: { not: 'REVOKED' } },
        },
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          closedAt: { gte: previous30Start, lt: previous30End },
          agent: { status: { not: 'REVOKED' } },
        },
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          closedAt: { gte: since90 },
          agent: { status: { not: 'REVOKED' } },
        },
      },
    }),
    prisma.repc.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deal: {
          status: 'CLOSED',
          agent: { status: { not: 'REVOKED' } },
        },
      },
    }),
    prisma.deal.count({ where: { status: 'CLOSED', closedAt: { gte: since30 }, agent: { status: { not: 'REVOKED' } } } }),
  ]);

  const closedVolume30 = Number(closedVolume30Agg._sum.purchasePrice || 0);
  const closedVolumePrev30 = Number(closedVolumePrev30Agg._sum.purchasePrice || 0);
  const closedVolume90 = Number(closedVolume90Agg._sum.purchasePrice || 0);
  const closedVolumeAllTime = Number(closedVolumeAllTimeAgg._sum.purchasePrice || 0);

  const closedVolumeDeltaPct =
    closedVolumePrev30 === 0 ? (closedVolume30 > 0 ? 100 : 0) : Number((((closedVolume30 - closedVolumePrev30) / closedVolumePrev30) * 100).toFixed(1));

  const defaultMonthlyPrice = 49.99;
  const isActiveSubscriber = (status: string) => status === 'ACTIVE';
  const isPastDueSubscriber = (status: string) => status === 'PAST_DUE';
  const isTrialSubscriber = (status: string) => status === 'TRIAL';
  const isBillableSubscriber = (status: string) => ['ACTIVE', 'PAST_DUE'].includes(status);

  const totalAgents = agents.length;
  const activeSubscribers = agents.filter((a) => isActiveSubscriber(String(a.subscriptionStatus))).length;
  const pastDueSubscribers = agents.filter((a) => isPastDueSubscriber(String(a.subscriptionStatus))).length;
  const trialSubscribers = agents.filter((a) => isTrialSubscriber(String(a.subscriptionStatus))).length;
  const billableSubscribers = agents.filter((a) => isBillableSubscriber(String(a.subscriptionStatus)) && a.billingMode !== 'FREE').length;
  const freePlanAgents = agents.filter((a) => a.billingMode === 'FREE').length;
  const customPlanAgents = agents.filter((a) => a.billingMode === 'CUSTOM').length;
  const standardPlanAgents = agents.filter((a) => a.billingMode === 'STANDARD').length;
  const overrideEnabledAgents = agents.filter((a) => a.billingAccessOverride).length;

  const estimatedMrr = Number(
    agents
      .filter((a) => isBillableSubscriber(String(a.subscriptionStatus)) && a.billingMode !== 'FREE')
      .reduce((sum, a) => {
        if (a.billingMode === 'CUSTOM' && typeof a.billingCustomPriceCents === 'number' && a.billingCustomPriceCents > 0) {
          return sum + a.billingCustomPriceCents / 100;
        }
        return sum + defaultMonthlyPrice;
      }, 0)
      .toFixed(2),
  );

  const estimatedArr = Number((estimatedMrr * 12).toFixed(2));
  const avgMrrPerAgent = totalAgents > 0 ? Number((estimatedMrr / totalAgents).toFixed(2)) : 0;

  const trendRows = await prisma.$queryRaw<Array<{ date: Date; deals: bigint | number; volume: unknown }>>(Prisma.sql`
    SELECT DATE(d."closedAt") AS date,
           COUNT(*)::bigint AS deals,
           COALESCE(SUM(r."purchasePrice"), 0) AS volume
    FROM "Repc" r
    INNER JOIN "Deal" d ON d."id" = r."dealId"
    WHERE d."status" = 'CLOSED'
      AND d."closedAt" IS NOT NULL
      AND d."closedAt" >= ${since30}
      AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = d."agentId" AND a."status" <> 'REVOKED')
    GROUP BY DATE(d."closedAt")
    ORDER BY date ASC
  `);

  const trendMap = new Map(
    trendRows.map((row) => [new Date(row.date).toISOString().slice(0, 10), { deals: Number(row.deals || 0), volume: Number(row.volume || 0) }]),
  );

  const trend30d: Array<{ date: string; closedDeals: number; closedVolume: number }> = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    trend30d.push({
      date: key,
      closedDeals: entry?.deals || 0,
      closedVolume: entry?.volume || 0,
    });
  }

  const topAgentRows = await prisma.$queryRaw<Array<{ agentId: string | null; deals: bigint | number; volume: unknown }>>(Prisma.sql`
    SELECT d."agentId" AS "agentId",
           COUNT(*)::bigint AS deals,
           COALESCE(SUM(r."purchasePrice"), 0) AS volume
    FROM "Repc" r
    INNER JOIN "Deal" d ON d."id" = r."dealId"
    WHERE d."status" = 'CLOSED'
      AND d."closedAt" IS NOT NULL
      AND d."closedAt" >= ${since30}
      AND d."agentId" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."id" = d."agentId" AND a."status" <> 'REVOKED')
    GROUP BY d."agentId"
    ORDER BY volume DESC
    LIMIT 8
  `);

  const topAgentIds = topAgentRows.map((row) => row.agentId).filter((id): id is string => Boolean(id));
  const topAgentProfiles = topAgentIds.length
    ? await prisma.agent.findMany({
        where: { id: { in: topAgentIds }, status: { not: 'REVOKED' } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const topAgentMap = new Map(topAgentProfiles.map((a) => [a.id, a]));

  const topAgents30d = topAgentRows
    .filter((row) => row.agentId)
    .map((row) => {
      const agentId = row.agentId as string;
      const profile = topAgentMap.get(agentId);
      return {
        agentId,
        name: profile?.name || 'Unknown agent',
        email: profile?.email || '',
        closedDeals: Number(row.deals || 0),
        closedVolume: Number(row.volume || 0),
      };
    });

  return res.json({
    totals: {
      totalAgents,
      activeSubscribers,
      pastDueSubscribers,
      trialSubscribers,
      billableSubscribers,
      freePlanAgents,
      standardPlanAgents,
      customPlanAgents,
      overrideEnabledAgents,
    },
    pricing: {
      estimatedMrr,
      estimatedArr,
      avgMrrPerAgent,
      defaultMonthlyPrice,
    },
    revenue: {
      closedDeals30d: closedDeals30,
      closedVolume30d: closedVolume30,
      closedVolumePrev30d: closedVolumePrev30,
      closedVolume90d: closedVolume90,
      closedVolumeAllTime,
      closedVolumeDeltaPct,
    },
    trend30d,
    topAgents30d,
  });
});

router.get('/billing/agent/:id/subscription', async (req, res) => {
  const agentId = req.params.id;
  const legalAcceptance = await getAgentLegalAcceptance(agentId);
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionStatus: true,
      billingAccessOverride: true,
      billingMode: true,
      billingCustomPriceCents: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!agent) return res.status(404).json({ error: 'Not found' });

  const defaultPlan = {
    name: 'AgentEasePro',
    price: 49.99,
    interval: 'month',
    features: [
      'Unlimited deals and clients',
      'AI-powered task generation',
      'Priority Action Center',
      'E-signature & REPC automation',
      'Multi-channel marketing blasts',
      'Calendar & task sync',
      'MLS/IDX integration',
      'Lead capture landing pages',
      'Win the Day goal tracking',
      'Referral network CRM',
      'Email & SMS notifications',
      'Data export & backup',
    ],
  };

  const plan =
    agent.billingMode === 'FREE'
      ? { ...defaultPlan, name: 'AgentEasePro (Free)', price: 0 }
      : agent.billingMode === 'CUSTOM' && typeof agent.billingCustomPriceCents === 'number' && agent.billingCustomPriceCents > 0
        ? { ...defaultPlan, name: 'AgentEasePro (Custom)', price: Number((agent.billingCustomPriceCents / 100).toFixed(2)) }
        : defaultPlan;

  let linkedCustomerId = agent.stripeCustomerId;
  if (agent.billingMode !== 'FREE' && stripe) {
    try {
      linkedCustomerId = await ensureInternalStripeCustomer({
        id: agent.id,
        email: agent.email,
        name: agent.name,
        stripeCustomerId: agent.stripeCustomerId,
      });
    } catch (err) {
      console.warn('Internal billing: unable to ensure Stripe customer link', err);
    }
  }

  if (agent.billingMode === 'FREE') {
    return res.json({
      status: 'active',
      billing: {
        mode: agent.billingMode,
        customPriceCents: agent.billingCustomPriceCents,
        stripeCustomerId: linkedCustomerId,
        stripeSubscriptionId: agent.stripeSubscriptionId,
      },
      billingAccessOverride: agent.billingAccessOverride,
      legalAcceptance,
      plan,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });
  }

  if (stripe && agent.stripeSubscriptionId) {
    try {
      const subResp = await stripe.subscriptions.retrieve(agent.stripeSubscriptionId, { expand: ['items.data.price'] });
      const sub = subResp as unknown as Stripe.Subscription;
      const firstItem = sub.items.data[0];
      const unitAmount = typeof firstItem?.price?.unit_amount === 'number' ? firstItem.price.unit_amount : null;
      const interval = firstItem?.price?.recurring?.interval || 'month';
      const itemPeriodStart = typeof (firstItem as any)?.current_period_start === 'number' ? (firstItem as any).current_period_start : null;
      const itemPeriodEnd = typeof (firstItem as any)?.current_period_end === 'number' ? (firstItem as any).current_period_end : null;
      return res.json({
        status: mapStripeStatusToInternal(sub.status),
        billing: {
          mode: agent.billingMode,
          customPriceCents: agent.billingCustomPriceCents,
          stripeCustomerId: linkedCustomerId,
          stripeSubscriptionId: agent.stripeSubscriptionId,
        },
        billingAccessOverride: agent.billingAccessOverride,
        legalAcceptance,
        plan: { ...defaultPlan, price: unitAmount != null ? Number((unitAmount / 100).toFixed(2)) : plan.price, interval },
        currentPeriodStart: new Date(((itemPeriodStart ?? Math.floor(Date.now() / 1000)) as number) * 1000).toISOString(),
        currentPeriodEnd: new Date(((itemPeriodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) as number) * 1000).toISOString(),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      });
    } catch (err) {
      console.warn('Internal billing: Stripe lookup failed, falling back', err);
    }
  }

  return res.json({
    status: mapDbStatusToInternal(agent.subscriptionStatus),
    billing: {
      mode: agent.billingMode,
      customPriceCents: agent.billingCustomPriceCents,
      stripeCustomerId: linkedCustomerId,
      stripeSubscriptionId: agent.stripeSubscriptionId,
    },
    billingAccessOverride: agent.billingAccessOverride,
    legalAcceptance,
    plan,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    trialEnd: agent.subscriptionStatus === 'TRIAL' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
  });
});

router.get('/billing/agent/:id/payment-method', async (req, res) => {
  const agentId = req.params.id;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      billingMode: true,
      stripeCustomerId: true,
    },
  });
  if (!agent) return res.status(404).json({ error: 'Not found' });

  if (agent.billingMode === 'FREE' || !stripe || !agent.stripeCustomerId) {
    return res.json(null);
  }

  try {
    const customer = await stripe.customers.retrieve(agent.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if ((customer as any).deleted) return res.json(null);

    const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    const pm =
      defaultPm && typeof defaultPm !== 'string'
        ? (defaultPm as Stripe.PaymentMethod)
        : (await stripe.paymentMethods.list({ customer: agent.stripeCustomerId, type: 'card', limit: 1 })).data[0];

    if (!pm || pm.type !== 'card' || !pm.card) return res.json(null);

    return res.json({
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      },
    });
  } catch (err) {
    console.warn('Internal billing payment method lookup failed:', err);
    return res.json(null);
  }
});

router.get('/billing/agent/:id/invoices', async (req, res) => {
  const agentId = req.params.id;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      billingMode: true,
      stripeCustomerId: true,
    },
  });
  if (!agent) return res.status(404).json({ error: 'Not found' });

  if (agent.billingMode === 'FREE' || !stripe || !agent.stripeCustomerId) {
    return res.json([]);
  }

  try {
    const invoices = await stripe.invoices.list({ customer: agent.stripeCustomerId, limit: 20 });
    return res.json(
      invoices.data.map((inv) => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: typeof inv.amount_paid === 'number' && inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due,
        status: inv.status || 'unknown',
        pdfUrl: inv.invoice_pdf || inv.hosted_invoice_url || null,
      }))
    );
  } catch (err) {
    console.warn('Internal billing invoices lookup failed:', err);
    return res.json([]);
  }
});

router.post('/billing/agent/:id/settings', async (req, res) => {
  const agentId = req.params.id;
  const body = z
    .object({
      billingMode: z.enum(['FREE', 'STANDARD', 'CUSTOM']),
      billingCustomPriceCents: z.number().int().min(100).max(500000).nullable().optional(),
    })
    .parse(req.body);

  const billingCustomPriceCents = body.billingMode === 'CUSTOM' ? body.billingCustomPriceCents ?? null : null;

  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: {
      billingMode: body.billingMode as any,
      billingCustomPriceCents,
      // Free plan implies access even if Stripe isn't linked yet.
      ...(body.billingMode === 'FREE' ? { subscriptionStatus: 'ACTIVE' } : {}),
    },
    select: { id: true, email: true, name: true, billingMode: true, billingCustomPriceCents: true, subscriptionStatus: true, stripeCustomerId: true },
  });

  if (updated.billingMode !== 'FREE' && stripe) {
    try {
      await ensureInternalStripeCustomer({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        stripeCustomerId: updated.stripeCustomerId,
      });
    } catch (err) {
      console.warn('Internal billing: unable to ensure Stripe customer after settings save', err);
    }
  }

  return res.json(updated);
});

router.get('/support', async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;

  const parsed = supportFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid filters', details: parsed.error.flatten() });
  }

  const { status, category, priority, q } = parsed.data;

  const where: Prisma.SupportRequestWhereInput = {
    status: status || undefined,
    category: category || undefined,
    priority: priority || undefined,
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
            { agent: { name: { contains: q, mode: 'insensitive' } } },
            { agent: { email: { contains: q, mode: 'insensitive' } } },
            { agent: { brokerageName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, requests, counts] = await Promise.all([
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        agent: { select: { id: true, name: true, email: true, brokerageName: true } },
      },
    }),
    prisma.supportRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ]);

  return res.json({
    page,
    pageSize,
    total,
    requests,
    counts: counts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {}),
  });
});

router.patch('/support/:id', async (req, res) => {
  const parsed = supportUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid update', details: parsed.error.flatten() });
  }

  const updates = parsed.data;
  const resolvedAt = updates.status && (updates.status === 'RESOLVED' || updates.status === 'CLOSED')
    ? new Date()
    : updates.status === 'OPEN' || updates.status === 'IN_PROGRESS'
      ? null
      : undefined;

  const updated = await prisma.supportRequest.update({
    where: { id: req.params.id },
    data: {
      ...updates,
      ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    },
    include: {
      agent: { select: { id: true, name: true, email: true, brokerageName: true } },
    },
  });

  return res.json({ request: updated });
});
