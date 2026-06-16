import { Router } from 'express';
import {
  BlastStatus,
  BlastPlaybook,
  BlastChannelType,
  ClientStage,
  ClientTemperature,
  Prisma,
  TaskBucket,
  TaskCategory,
  TaskCreatedFrom,
  TaskPriority,
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
import {
  getMonthlyAgentEmailLimit,
  getMonthlyAgentEmailUsage,
  resolveEmailIdentity,
  sendMarketingEmail,
} from '../services/emailService';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createAIChatCompletion, isAIConfigured } from '../lib/aiClient';
export const router = Router();

async function getAgentEmailIdentity(agentId: string) {
  const [connection, agent] = await Promise.all([
    prisma.agentChannelConnection.findUnique({
      where: {
        agentId_type: {
          agentId,
          type: 'EMAIL',
        },
      },
      select: { config: true },
    }),
    prisma.agent.findUnique({ where: { id: agentId }, select: { email: true, name: true } }),
  ]);

  const config = (connection?.config || {}) as Record<string, unknown>;
  const fromEmail = typeof config.fromEmail === 'string' ? config.fromEmail.trim() : '';
  const fromName = typeof config.fromName === 'string' ? config.fromName.trim() : '';
  const fallbackEmail = normalizeRecipientEmail(agent?.email) || '';

  return {
    fromEmail: fromEmail || fallbackEmail || undefined,
    fromName: fromName || agent?.name || undefined,
    replyTo: fromEmail || fallbackEmail || undefined,
  };
}

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

function normalizeRecipientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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

const MONTHLY_MARKETING_EMAIL_LIMIT = getMonthlyAgentEmailLimit();
const MARKETING_SUPPRESSING_EVENT_TYPES = ['UNSUBSCRIBE', 'SPAMREPORT', 'BOUNCE', 'BLOCKED', 'DROPPED'];
const MARKETING_ENGAGEMENT_EVENT_TYPES = ['OPEN', 'CLICK', 'INBOUND_REPLY'];
const MARKETING_SENT_EVENT_TYPES = ['PROCESSED', 'DELIVERED'];
const MarketingAudienceModeSchema = z.enum(['ALL', 'ENGAGED', 'NON_OPENERS', 'AI_RECOMMENDED']);
type MarketingAudienceMode = z.infer<typeof MarketingAudienceModeSchema>;

const MassEmailSchema = z
  .object({
    audienceType: z.enum(['CLIENTS', 'LEADS', 'CLIENTS_AND_LEADS']).default('CLIENTS_AND_LEADS'),
    audienceMode: MarketingAudienceModeSchema.default('ALL'),
    sourceBlastId: z.string().min(1).optional(),
    subject: z.string().trim().min(3).max(180),
    message: z.string().trim().min(5).max(25000),
    limit: z.number().int().min(1).max(200).optional(),
    scheduledAt: z.string().datetime().optional(),
    recipientEmails: z.array(z.string().trim().email()).max(2000).optional(),
  })
  .strict();

const MassEmailPreviewSchema = z
  .object({
    audienceType: z.enum(['CLIENTS', 'LEADS', 'CLIENTS_AND_LEADS']).default('CLIENTS_AND_LEADS'),
    audienceMode: MarketingAudienceModeSchema.default('ALL'),
    sourceBlastId: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    recipientEmails: z.array(z.string().trim().email()).max(2000).optional(),
  })
  .strict();

function normalizeRecipientList(emails: string[] | undefined, maxRecipients: number): string[] {
  if (!Array.isArray(emails) || emails.length === 0) return [];
  const deduped = Array.from(
    new Set(
      emails
        .map((email) => normalizeRecipientEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );
  return deduped.slice(0, Math.max(1, maxRecipients));
}

async function findSuppressedMarketingEmails(emails: string[]) {
  const normalized = Array.from(
    new Set(emails.map((email) => normalizeRecipientEmail(email)).filter((email): email is string => Boolean(email))),
  );
  const suppressed = new Set<string>();
  const chunkSize = 900;

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    const rows = await prisma.marketingEmailEvent.findMany({
      where: {
        eventType: { in: MARKETING_SUPPRESSING_EVENT_TYPES },
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

async function resolveSendableMarketingRecipients(recipients: string[]) {
  const normalized = Array.from(
    new Set(recipients.map((email) => normalizeRecipientEmail(email)).filter((email): email is string => Boolean(email))),
  );
  const suppressedEmails = await findSuppressedMarketingEmails(normalized);
  return {
    recipients: normalized.filter((email) => !suppressedEmails.has(email)),
    suppressedEmails,
  };
}

type EmailEventStats = {
  processed: number;
  delivered: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  spamReports: number;
  lastEventAt: Date | null;
};

type MarketingContactCandidate = {
  id: string;
  contactType: 'client' | 'lead';
  name: string;
  email: string;
  stage?: string | null;
  temperature?: string | null;
  priority?: string | null;
  tags?: string[];
  lastContactAt?: Date | null;
  lastMarketingAt?: Date | null;
  createdAt: Date;
};

function emptyEmailStats(): EmailEventStats {
  return {
    processed: 0,
    delivered: 0,
    opens: 0,
    clicks: 0,
    replies: 0,
    bounces: 0,
    unsubscribes: 0,
    spamReports: 0,
    lastEventAt: null,
  };
}

function getStatsForEmail(statsByEmail: Map<string, EmailEventStats>, email: string) {
  const normalized = normalizeRecipientEmail(email) || '';
  if (!statsByEmail.has(normalized)) statsByEmail.set(normalized, emptyEmailStats());
  return statsByEmail.get(normalized)!;
}

async function getMarketingEmailStats(params: {
  agentId: string;
  emails: string[];
  since?: Date;
  blastId?: string;
}) {
  const normalizedEmails = Array.from(
    new Set(params.emails.map((email) => normalizeRecipientEmail(email)).filter((email): email is string => Boolean(email))),
  );
  const statsByEmail = new Map<string, EmailEventStats>();
  const chunkSize = 900;

  for (let index = 0; index < normalizedEmails.length; index += chunkSize) {
    const chunk = normalizedEmails.slice(index, index + chunkSize);
    const rows = await prisma.marketingEmailEvent.findMany({
      where: {
        agentId: params.agentId,
        email: { in: chunk },
        ...(params.since ? { occurredAt: { gte: params.since } } : {}),
        ...(params.blastId ? { blastId: params.blastId } : {}),
      },
      select: { email: true, eventType: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
    });

    for (const row of rows) {
      const email = normalizeRecipientEmail(row.email);
      if (!email) continue;
      const stats = getStatsForEmail(statsByEmail, email);
      const eventType = (row.eventType || '').toUpperCase();
      if (eventType === 'PROCESSED') stats.processed += 1;
      if (eventType === 'DELIVERED') stats.delivered += 1;
      if (eventType === 'OPEN') stats.opens += 1;
      if (eventType === 'CLICK') stats.clicks += 1;
      if (eventType === 'INBOUND_REPLY') stats.replies += 1;
      if (['BOUNCE', 'BLOCKED', 'DROPPED', 'DEFERRED'].includes(eventType)) stats.bounces += 1;
      if (eventType === 'UNSUBSCRIBE') stats.unsubscribes += 1;
      if (eventType === 'SPAMREPORT') stats.spamReports += 1;
      if (!stats.lastEventAt || row.occurredAt > stats.lastEventAt) stats.lastEventAt = row.occurredAt;
    }
  }

  return statsByEmail;
}

function hasMarketingEngagement(stats?: EmailEventStats) {
  return Boolean(stats && (stats.opens > 0 || stats.clicks > 0 || stats.replies > 0));
}

function hasMarketingSendSignal(stats?: EmailEventStats) {
  return Boolean(stats && (stats.processed > 0 || stats.delivered > 0 || stats.opens > 0 || stats.clicks > 0));
}

export function scoreMarketingAudienceCandidate(candidate: MarketingContactCandidate, stats: EmailEventStats | undefined, now = new Date()) {
  let score = 20;
  const reasons: string[] = [];

  if (candidate.contactType === 'client') {
    if (candidate.temperature === 'HOT') {
      score += 24;
      reasons.push('hot client');
    } else if (candidate.temperature === 'WARM') {
      score += 14;
      reasons.push('warm client');
    }

    if (['NEW_LEAD', 'NURTURE', 'ACTIVE'].includes(candidate.stage || '')) {
      score += 12;
      reasons.push('active pipeline stage');
    } else if (candidate.stage === 'PAST_CLIENT') {
      score += 8;
      reasons.push('past client touchpoint');
    }
  }

  if (candidate.contactType === 'lead') {
    if (candidate.priority === 'HOT') {
      score += 24;
      reasons.push('hot lead');
    } else if (candidate.priority === 'WARM') {
      score += 14;
      reasons.push('warm lead');
    }
  }

  if (stats) {
    if (stats.clicks > 0) {
      score += Math.min(30, stats.clicks * 12);
      reasons.push('clicked past email');
    }
    if (stats.replies > 0) {
      score += Math.min(34, stats.replies * 18);
      reasons.push('replied to email');
    }
    if (stats.opens > 0) {
      score += Math.min(20, stats.opens * 6);
      reasons.push('opened past email');
    }
  }

  if (candidate.lastMarketingAt) {
    const daysSinceMarketing = Math.floor((now.getTime() - candidate.lastMarketingAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceMarketing >= 21) {
      score += 6;
      reasons.push('not recently marketed');
    } else if (daysSinceMarketing < 7) {
      score -= 8;
      reasons.push('recently marketed');
    }
  } else {
    score += 5;
    reasons.push('fresh marketing touch');
  }

  if (candidate.lastContactAt) {
    const daysSinceContact = Math.floor((now.getTime() - candidate.lastContactAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceContact >= 14) {
      score += 4;
      reasons.push('due for follow-up');
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 4),
  };
}

async function applyMarketingAudienceMode(params: {
  agentId: string;
  recipients: string[];
  audienceMode: MarketingAudienceMode;
  maxRecipients: number;
  sourceBlastId?: string;
}) {
  const normalized = Array.from(
    new Set(params.recipients.map((email) => normalizeRecipientEmail(email)).filter((email): email is string => Boolean(email))),
  );

  if (params.audienceMode === 'ALL') {
    return { recipients: normalized.slice(0, params.maxRecipients), matchedRecipientsCount: normalized.length };
  }

  const since = params.audienceMode === 'ENGAGED' || params.audienceMode === 'AI_RECOMMENDED'
    ? new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const statsByEmail = await getMarketingEmailStats({
    agentId: params.agentId,
    emails: normalized,
    since,
    blastId: params.sourceBlastId,
  });

  if (params.audienceMode === 'ENGAGED') {
    const recipients = normalized.filter((email) => hasMarketingEngagement(statsByEmail.get(email)));
    return { recipients: recipients.slice(0, params.maxRecipients), matchedRecipientsCount: recipients.length };
  }

  if (params.audienceMode === 'NON_OPENERS') {
    const recipients = normalized.filter((email) => {
      const stats = statsByEmail.get(email);
      return hasMarketingSendSignal(stats) && !hasMarketingEngagement(stats);
    });
    return { recipients: recipients.slice(0, params.maxRecipients), matchedRecipientsCount: recipients.length };
  }

  const ranked = normalized
    .map((email) => {
      const stats = statsByEmail.get(email);
      const score = 20 + (stats?.opens || 0) * 6 + (stats?.clicks || 0) * 14 + (stats?.replies || 0) * 20;
      return { email, score };
    })
    .sort((a, b) => b.score - a.score || a.email.localeCompare(b.email));

  return {
    recipients: ranked.slice(0, params.maxRecipients).map((item) => item.email),
    matchedRecipientsCount: ranked.length,
  };
}

async function getMarketingContactCandidates(params: {
  agentId: string;
  audienceType: 'CLIENTS' | 'LEADS' | 'CLIENTS_AND_LEADS';
  limit: number;
}): Promise<MarketingContactCandidate[]> {
  const take = Math.min(1000, Math.max(100, params.limit * 8));
  const includeClients = params.audienceType === 'CLIENTS' || params.audienceType === 'CLIENTS_AND_LEADS';
  const includeLeads = params.audienceType === 'LEADS' || params.audienceType === 'CLIENTS_AND_LEADS';

  const [clients, leads] = await Promise.all([
    includeClients
      ? prisma.client.findMany({
          where: { agentId: params.agentId, deletedAt: null, email: { not: null } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            stage: true,
            temperature: true,
            tags: true,
            lastContactAt: true,
            lastMarketingAt: true,
            createdAt: true,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take,
        })
      : Promise.resolve([]),
    includeLeads
      ? prisma.lead.findMany({
          where: { agentId: params.agentId, converted: false, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            priority: true,
            tags: true,
            lastContact: true,
            createdAt: true,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take,
        })
      : Promise.resolve([]),
  ]);

  const candidates: MarketingContactCandidate[] = [];
  for (const client of clients) {
    const email = normalizeRecipientEmail(client.email);
    if (!email) continue;
    candidates.push({
      id: client.id,
      contactType: 'client',
      name: `${client.firstName} ${client.lastName}`.trim() || email,
      email,
      stage: client.stage,
      temperature: client.temperature,
      tags: client.tags || [],
      lastContactAt: client.lastContactAt,
      lastMarketingAt: client.lastMarketingAt,
      createdAt: client.createdAt,
    });
  }

  for (const lead of leads) {
    const email = normalizeRecipientEmail(lead.email);
    if (!email) continue;
    candidates.push({
      id: lead.id,
      contactType: 'lead',
      name: `${lead.firstName} ${lead.lastName}`.trim() || email,
      email,
      priority: lead.priority,
      tags: lead.tags || [],
      lastContactAt: lead.lastContact,
      lastMarketingAt: null,
      createdAt: lead.createdAt,
    });
  }

  const deduped = new Map<string, MarketingContactCandidate>();
  for (const candidate of candidates) {
    if (!deduped.has(candidate.email)) deduped.set(candidate.email, candidate);
  }
  return Array.from(deduped.values());
}

async function rankMarketingAudienceCandidates(params: {
  agentId: string;
  audienceType: 'CLIENTS' | 'LEADS' | 'CLIENTS_AND_LEADS';
  limit: number;
}) {
  const candidates = await getMarketingContactCandidates(params);
  const suppressed = await findSuppressedMarketingEmails(candidates.map((candidate) => candidate.email));
  const sendableCandidates = candidates.filter((candidate) => !suppressed.has(candidate.email));
  const statsByEmail = await getMarketingEmailStats({
    agentId: params.agentId,
    emails: sendableCandidates.map((candidate) => candidate.email),
    since: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  });
  const now = new Date();

  return sendableCandidates
    .map((candidate) => {
      const stats = statsByEmail.get(candidate.email);
      const scored = scoreMarketingAudienceCandidate(candidate, stats, now);
      return {
        ...candidate,
        score: scored.score,
        reasons: scored.reasons,
        engagement: {
          opens: stats?.opens || 0,
          clicks: stats?.clicks || 0,
          replies: stats?.replies || 0,
          lastEventAt: stats?.lastEventAt || null,
        },
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, params.limit);
}

async function buildAudienceStrategy(params: {
  recommendations: Awaited<ReturnType<typeof rankMarketingAudienceCandidates>>;
  audienceType: string;
}) {
  const fallback = 'Prioritizes people with recent opens, clicks, replies, hot/warm status, active stages, and contacts due for a timely touch.';
  if (!isAIConfigured() || params.recommendations.length === 0) return fallback;

  try {
    const aggregate = params.recommendations.reduce(
      (acc, item) => {
        acc.avgScore += item.score;
        acc.clicks += item.engagement.clicks;
        acc.opens += item.engagement.opens;
        acc.replies += item.engagement.replies;
        acc.reasons.push(...item.reasons);
        return acc;
      },
      { avgScore: 0, clicks: 0, opens: 0, replies: 0, reasons: [] as string[] },
    );
    aggregate.avgScore = Math.round(aggregate.avgScore / params.recommendations.length);

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a concise real estate marketing strategist. Return JSON only.',
        },
        {
          role: 'user',
          content: `Summarize this recommended marketing audience in one practical sentence for an agent. Do not mention private contact details. JSON: {"strategy":"..."}\n${JSON.stringify({ audienceType: params.audienceType, count: params.recommendations.length, aggregate })}`,
        },
      ],
      responseFormat: 'json_object',
      temperature: 0.4,
      maxTokens: 140,
      cacheKey: 'marketing-audience-strategy',
      cacheTtlMs: 5 * 60 * 1000,
    });
    const parsed = JSON.parse(content || '{}');
    return typeof parsed.strategy === 'string' && parsed.strategy.trim() ? parsed.strategy.trim() : fallback;
  } catch (error) {
    console.error('AI audience strategy failed:', error);
    return fallback;
  }
}

function calculateRate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

async function createEngagementTasksForBlast(params: { agentId: string; blastId: string; limit?: number }) {
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const events = await prisma.marketingEmailEvent.findMany({
    where: {
      agentId: params.agentId,
      blastId: params.blastId,
      eventType: { in: ['CLICK', 'INBOUND_REPLY'] },
      email: { not: null },
      occurredAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    select: { email: true, eventType: true, url: true, occurredAt: true },
    orderBy: { occurredAt: 'desc' },
    take: limit * 4,
  });

  const unique = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    const email = normalizeRecipientEmail(event.email);
    if (!email) continue;
    const key = `${email}:${event.eventType}`;
    if (!unique.has(key)) unique.set(key, event);
  }

  let created = 0;
  let skipped = 0;
  const tasks: Array<{ id: string; title: string; email: string; eventType: string }> = [];

  for (const event of Array.from(unique.values()).slice(0, limit)) {
    const email = normalizeRecipientEmail(event.email);
    if (!email) continue;
    const eventType = (event.eventType || '').toUpperCase();
    const tag = `marketing-engagement:${params.blastId}:${email}:${eventType}`;
    const [client, existing] = await Promise.all([
      prisma.client.findFirst({
        where: { agentId: params.agentId, email: { equals: email, mode: 'insensitive' } },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.task.findFirst({
        where: {
          agentId: params.agentId,
          marketingBlastId: params.blastId,
          status: 'OPEN',
          description: { contains: tag },
        },
        select: { id: true },
      }),
    ]);

    if (existing) {
      skipped += 1;
      continue;
    }

    const contactName = client ? `${client.firstName} ${client.lastName}`.trim() : email;
    const title = eventType === 'CLICK'
      ? `Follow up with ${contactName} - clicked campaign`
      : `Follow up with ${contactName} - replied to email`;

    const task = await prisma.task.create({
      data: {
        agentId: params.agentId,
        clientId: client?.id,
        marketingBlastId: params.blastId,
        title,
        description: `${tag}\n${eventType === 'CLICK' ? 'Clicked a marketing email link.' : 'Replied to a marketing email.'}${event.url ? `\nURL: ${event.url}` : ''}`,
        category: TaskCategory.MARKETING,
        priority: TaskPriority.HIGH,
        bucket: TaskBucket.TODAY,
        dueAt: new Date(),
        createdFrom: TaskCreatedFrom.SYSTEM,
      },
      select: { id: true, title: true },
    });

    tasks.push({ id: task.id, title: task.title, email, eventType });
    created += 1;
  }

  return { created, skipped, tasks };
}

function buildMarketingEmailOptions(replyTo?: string) {
  const replyEmail = normalizeRecipientEmail(replyTo);
  const unsubscribeMailto = replyEmail
    ? `mailto:${encodeURIComponent(replyEmail)}?subject=${encodeURIComponent('Unsubscribe from marketing emails')}`
    : undefined;
  const asmGroupId = Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || 0);
  const headers: Record<string, string> = {
    Precedence: 'bulk',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
  };

  if (unsubscribeMailto) {
    headers['List-Unsubscribe'] = `<${unsubscribeMailto}>`;
  }

  return {
    unsubscribeUrl: unsubscribeMailto,
    headers,
    asm: Number.isFinite(asmGroupId) && asmGroupId > 0 ? { groupId: asmGroupId } : undefined,
  };
}

async function getMonthlyMarketingEmailUsage(agentId: string) {
  return getMonthlyAgentEmailUsage(agentId);
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
          where: { agentId: params.agentId },
          select: { email: true },
          orderBy: { createdAt: 'desc' },
          take: maxRecipients,
        })
      : Promise.resolve([]),
    includeLeads
      ? prisma.lead.findMany({
          where: { agentId: params.agentId, converted: false },
          select: { email: true },
          orderBy: { createdAt: 'desc' },
          take: maxRecipients,
        })
      : Promise.resolve([]),
  ]);

  const deduped = Array.from(
    new Set(
      [...clients.map((c) => c.email), ...leads.map((l) => l.email)]
        .map(normalizeRecipientEmail)
        .filter((email): email is string => Boolean(email)),
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
        const { recipients: sendableRecipients, suppressedEmails } = await resolveSendableMarketingRecipients(recipients);

        const usage = await getMonthlyMarketingEmailUsage(blast.agentId);
        const projectedSendCount = sendableRecipients.length * emailChannels.length;
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

        if (sendableRecipients.length === 0 || emailChannels.length === 0) {
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
                recipientsCount: sendableRecipients.length,
                recipientsSample: sendableRecipients.slice(0, 12),
                audienceType,
                error:
                  recipients.length === 0
                    ? 'Scheduled send skipped: no recipients found.'
                    : sendableRecipients.length === 0
                      ? `Scheduled send skipped: all ${suppressedEmails.size} recipient(s) are suppressed due to prior unsubscribes, bounces, or spam reports.`
                      : 'Scheduled send skipped: no email channels enabled.',
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

        const [agent, emailIdentity] = await Promise.all([
          prisma.agent.findUnique({ where: { id: blast.agentId }, select: { name: true } }),
          getAgentEmailIdentity(blast.agentId),
        ]);
        const emailOptions = buildMarketingEmailOptions(emailIdentity.replyTo);
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
            agentId: blast.agentId,
            recipients: sendableRecipients,
            subject: channel.previewText || blast.title,
            htmlContent,
            listingAddress: blast.listing?.headline || undefined,
            agentName: agent?.name || undefined,
            fromEmail: emailIdentity.fromEmail,
            fromName: emailIdentity.fromName || agent?.name || undefined,
            replyTo: emailIdentity.replyTo,
            unsubscribeUrl: emailOptions.unsubscribeUrl,
            headers: emailOptions.headers,
            asm: emailOptions.asm,
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
              recipientsCount: sendableRecipients.length,
              recipientsSample: sendableRecipients.slice(0, 12),
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

router.get('/email/sender-health', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const identity = await getAgentEmailIdentity(req.agentId);
    const resolved = resolveEmailIdentity(identity);
    const senderEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SENDER_EMAIL || '';
    const allowedDomains = (process.env.SENDGRID_ALLOWED_FROM_DOMAINS || '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);

    const rows = await prisma.marketingEmailEvent.findMany({
      where: {
        agentId: req.agentId,
        occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { eventType: true, email: true },
    });

    const uniqueDelivered = new Set<string>();
    let delivered = 0;
    let opens = 0;
    let clicks = 0;
    let bounces = 0;
    let unsubscribes = 0;
    let spamReports = 0;

    for (const row of rows) {
      const eventType = (row.eventType || '').toUpperCase();
      const email = normalizeRecipientEmail(row.email) || '';
      if (eventType === 'DELIVERED') {
        delivered += 1;
        if (email) uniqueDelivered.add(email);
      }
      if (eventType === 'OPEN') opens += 1;
      if (eventType === 'CLICK') clicks += 1;
      if (['BOUNCE', 'BLOCKED', 'DROPPED'].includes(eventType)) bounces += 1;
      if (eventType === 'UNSUBSCRIBE') unsubscribes += 1;
      if (eventType === 'SPAMREPORT') spamReports += 1;
    }

    const checks = [
      {
        key: 'sendgridKey',
        label: 'SendGrid API key',
        status: process.env.SENDGRID_API_KEY ? 'ready' : 'needs_setup',
      },
      {
        key: 'verifiedSender',
        label: 'Verified sending email',
        status: senderEmail ? 'ready' : 'needs_setup',
      },
      {
        key: 'replyTo',
        label: 'Agent reply-to',
        status: resolved.replyTo ? 'ready' : 'attention',
      },
      {
        key: 'unsubscribe',
        label: 'Unsubscribe protection',
        status: process.env.SENDGRID_MARKETING_UNSUBSCRIBE_GROUP_ID ? 'ready' : 'attention',
      },
      {
        key: 'domainPolicy',
        label: 'Custom sender domains',
        status: resolved.fromEmail === identity.fromEmail ? 'ready' : 'verified_sender_fallback',
      },
    ];

    const hasCriticalIssue = checks.some((check) => check.status === 'needs_setup');
    const hasAttention = checks.some((check) => check.status === 'attention' || check.status === 'verified_sender_fallback');

    res.json({
      status: hasCriticalIssue ? 'needs_setup' : hasAttention ? 'attention' : 'ready',
      identity: {
        requestedFromEmail: identity.fromEmail,
        sendingFromEmail: resolved.fromEmail,
        fromName: resolved.fromName,
        replyTo: resolved.replyTo,
        usingVerifiedFallback: resolved.fromEmail !== identity.fromEmail,
        allowedCustomDomains: allowedDomains,
      },
      checks,
      deliverability: {
        windowDays: 30,
        delivered,
        uniqueDelivered: uniqueDelivered.size,
        opens,
        clicks,
        bounces,
        unsubscribes,
        spamReports,
        openRate: calculateRate(opens, delivered),
        clickRate: calculateRate(clicks, delivered),
        bounceRate: calculateRate(bounces, Math.max(delivered + bounces, 1)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/email/audience-recommendations', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = z
      .object({
        audienceType: z.enum(['CLIENTS', 'LEADS', 'CLIENTS_AND_LEADS']).default('CLIENTS_AND_LEADS'),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const recommendations = await rankMarketingAudienceCandidates({
      agentId: req.agentId,
      audienceType: parsed.data.audienceType,
      limit: parsed.data.limit,
    });
    const strategy = await buildAudienceStrategy({ recommendations, audienceType: parsed.data.audienceType });

    res.json({
      audienceType: parsed.data.audienceType,
      count: recommendations.length,
      recipientEmails: recommendations.map((item) => item.email),
      aiConfigured: isAIConfigured(),
      strategy,
      recommendations: recommendations.map((item) => ({
        id: item.id,
        contactType: item.contactType,
        name: item.name,
        email: item.email,
        score: item.score,
        reasons: item.reasons,
        engagement: item.engagement,
      })),
    });
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
        audienceMode: parsed.data.audienceMode,
        recipientsCount: 0,
        suppressedRecipientsCount: 0,
        matchedRecipientsCount: 0,
        sample: [],
      });
    }

    const requestedLimit = Math.max(1, Math.min(parsed.data.limit ?? usage.remaining, usage.remaining));
    const explicitRecipients = normalizeRecipientList(parsed.data.recipientEmails, requestedLimit);
    const poolLimit = explicitRecipients.length > 0
      ? explicitRecipients.length
      : parsed.data.audienceMode === 'ALL'
        ? requestedLimit
        : Math.min(MONTHLY_MARKETING_EMAIL_LIMIT, Math.max(requestedLimit * 4, requestedLimit));
    const recipients = explicitRecipients.length > 0
      ? explicitRecipients
      : await resolveMassEmailRecipients({
          agentId: req.agentId,
          audienceType: parsed.data.audienceType,
          maxRecipients: poolLimit,
        });
    const smartAudience = await applyMarketingAudienceMode({
      agentId: req.agentId,
      recipients,
      audienceMode: parsed.data.audienceMode,
      sourceBlastId: parsed.data.sourceBlastId,
      maxRecipients: requestedLimit,
    });
    const { recipients: sendableRecipients, suppressedEmails } = await resolveSendableMarketingRecipients(smartAudience.recipients);

    res.json({
      ...usage,
      audienceType: parsed.data.audienceType,
      audienceMode: parsed.data.audienceMode,
      sourceBlastId: parsed.data.sourceBlastId,
      recipientsCount: sendableRecipients.length,
      suppressedRecipientsCount: suppressedEmails.size,
      matchedRecipientsCount: smartAudience.matchedRecipientsCount,
      sample: sendableRecipients.slice(0, 12),
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
    const explicitRecipients = normalizeRecipientList(parsed.data.recipientEmails, requestedLimit);

    if (isScheduled && parsed.data.audienceMode !== 'ALL') {
      return res.status(400).json({ error: 'Smart audiences are currently send-now only. Schedule a standard audience or send this segment now.' });
    }

    if (isScheduled && explicitRecipients.length > 0) {
      return res.status(400).json({
        error: 'Scheduling is not supported for custom selected-recipient sends yet. Send now instead.',
      });
    }

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

    const recipients = explicitRecipients.length > 0
      ? explicitRecipients
      : await resolveMassEmailRecipients({
          agentId: req.agentId,
          audienceType: parsed.data.audienceType,
          maxRecipients: parsed.data.audienceMode === 'ALL'
            ? requestedLimit
            : Math.min(MONTHLY_MARKETING_EMAIL_LIMIT, Math.max(requestedLimit * 4, requestedLimit)),
        });

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found for selected audience' });
    }

    const emailIdentity = await getAgentEmailIdentity(req.agentId);
    const smartAudience = await applyMarketingAudienceMode({
      agentId: req.agentId,
      recipients,
      audienceMode: parsed.data.audienceMode,
      sourceBlastId: parsed.data.sourceBlastId,
      maxRecipients: requestedLimit,
    });
    const { recipients: sendableRecipients, suppressedEmails } = await resolveSendableMarketingRecipients(smartAudience.recipients);
    if (sendableRecipients.length === 0) {
      return res.status(400).json({
        error: parsed.data.audienceMode === 'ALL'
          ? 'All selected recipients are suppressed due to prior unsubscribes, bounces, or spam reports.'
          : 'No sendable contacts matched this smart audience segment.',
        suppressedRecipientsCount: suppressedEmails.size,
        matchedRecipientsCount: smartAudience.matchedRecipientsCount,
      });
    }
    const emailOptions = buildMarketingEmailOptions(emailIdentity.replyTo);

    const result = await sendMarketingEmail({
      agentId: req.agentId,
      recipients: sendableRecipients,
      subject: parsed.data.subject,
      htmlContent: messageHtml,
      agentName: agent?.name || undefined,
      fromEmail: emailIdentity.fromEmail,
      fromName: emailIdentity.fromName || agent?.name || undefined,
      replyTo: emailIdentity.replyTo,
      unsubscribeUrl: emailOptions.unsubscribeUrl,
      headers: emailOptions.headers,
      asm: emailOptions.asm,
      categories: ['marketing_blast', 'mass_email'],
      customArgs: {
        agentId: req.agentId,
        blastId: blast.id,
        channelId: emailChannel.id,
        audienceType: parsed.data.audienceType,
        audienceMode: parsed.data.audienceMode,
        ...(parsed.data.sourceBlastId ? { sourceBlastId: parsed.data.sourceBlastId } : {}),
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
        recipientsCount: sendableRecipients.length,
        recipientsSample: sendableRecipients.slice(0, 12),
        audienceType: parsed.data.audienceMode === 'ALL'
          ? parsed.data.audienceType
          : `${parsed.data.audienceType}:${parsed.data.audienceMode}`,
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
      audienceMode: parsed.data.audienceMode,
      recipientsCount: sendableRecipients.length,
      suppressedRecipientsCount: suppressedEmails.size,
      matchedRecipientsCount: smartAudience.matchedRecipientsCount,
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
    return Array.from(new Set(leads.map((l) => normalizeRecipientEmail(l.email)).filter((email): email is string => Boolean(email))));
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
      const buyerEmail = normalizeRecipientEmail(d.buyer?.email);
      const sellerEmail = normalizeRecipientEmail(d.seller?.email);
      if (buyerEmail) emails.push(buyerEmail);
      if (sellerEmail) emails.push(sellerEmail);
    }
    return Array.from(new Set(emails));
  }

  // CLIENTS
  const clients = await prisma.client.findMany({
    where: { agentId: params.agentId },
    select: { email: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return Array.from(new Set(clients.map((c) => normalizeRecipientEmail(c.email)).filter((email): email is string => Boolean(email))));
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
    const { recipients: sendableRecipientEmails, suppressedEmails } = emailChannels.length > 0
      ? await resolveSendableMarketingRecipients(recipientEmails)
      : { recipients: recipientEmails, suppressedEmails: new Set<string>() };

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
      const projectedSendCount = sendableRecipientEmails.length * emailChannels.length;

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
    const emailIdentity = await getAgentEmailIdentity(req.agentId);
    const emailOptions = buildMarketingEmailOptions(emailIdentity.replyTo);

    for (const channel of emailChannels) {
      if (!channel.previewHtml && !channel.previewText) {
        console.warn(`⚠️ Skipping email send for channel ${channel.id} - no content`);
        deliveryResults.push({ channelId: channel.id, ok: false, error: 'Missing email content', recipientsCount: 0 });
        continue;
      }

      if (sendableRecipientEmails.length === 0) {
        deliveryResults.push({
          channelId: channel.id,
          ok: false,
          error:
            recipientEmails.length === 0
              ? 'No recipients found'
              : 'All recipients suppressed due to prior unsubscribes, bounces, or spam reports',
          recipientsCount: 0,
        });
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

      const recipientsSample = sendableRecipientEmails.slice(0, 5);

      const result = await sendMarketingEmail({
        agentId: req.agentId,
        recipients: sendableRecipientEmails,
        subject: channel.previewText || blast.title,
        htmlContent: fullHtml,
        listingAddress: blast.listing?.headline || undefined,
        agentName: agent?.name || undefined,
        fromEmail: emailIdentity.fromEmail,
        fromName: emailIdentity.fromName || agent?.name || undefined,
        replyTo: emailIdentity.replyTo,
        unsubscribeUrl: emailOptions.unsubscribeUrl,
        headers: emailOptions.headers,
        asm: emailOptions.asm,
        categories: ['marketing_blast'],
        customArgs: {
          agentId: req.agentId,
          blastId: blast.id,
          channelId: channel.id,
          audienceType,
        },
      });

      if (result.success) {
        console.log(`✅ Marketing email sent to ${sendableRecipientEmails.length} recipients for blast ${blast.id}`);
        deliveryResults.push({
          channelId: channel.id,
          ok: true,
          messageId: result.messageId,
          recipientsCount: sendableRecipientEmails.length,
        });
      } else {
        console.error(`❌ Marketing email failed for blast ${blast.id}:`, result.error);
        deliveryResults.push({
          channelId: channel.id,
          ok: false,
          error: result.error || 'SendGrid send failed',
          recipientsCount: sendableRecipientEmails.length,
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
          recipientsCount: sendableRecipientEmails.length,
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
        recipientsCount: sendableRecipientEmails.length,
        suppressedRecipientsCount: suppressedEmails.size,
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

router.get('/blasts/:id/non-openers', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const blast = await requireBlast(req.agentId, req.params.id);
    const events = await prisma.marketingEmailEvent.findMany({
      where: { agentId: req.agentId, blastId: req.params.id, email: { not: null } },
      select: { email: true, eventType: true },
      orderBy: { occurredAt: 'desc' },
    });

    const sent = new Set<string>();
    const engaged = new Set<string>();
    const suppressedSignals = new Set<string>();

    for (const event of events) {
      const email = normalizeRecipientEmail(event.email);
      if (!email) continue;
      const eventType = (event.eventType || '').toUpperCase();
      if (MARKETING_SENT_EVENT_TYPES.includes(eventType) || MARKETING_ENGAGEMENT_EVENT_TYPES.includes(eventType)) sent.add(email);
      if (MARKETING_ENGAGEMENT_EVENT_TYPES.includes(eventType)) engaged.add(email);
      if (MARKETING_SUPPRESSING_EVENT_TYPES.includes(eventType)) suppressedSignals.add(email);
    }

    const rawNonOpeners = Array.from(sent).filter((email) => !engaged.has(email) && !suppressedSignals.has(email));
    const { recipients, suppressedEmails } = await resolveSendableMarketingRecipients(rawNonOpeners);
    const emailChannel = blast.channels.find((channel) => channel.channel === BlastChannelType.EMAIL);

    res.json({
      blastId: blast.id,
      title: blast.title,
      count: recipients.length,
      recipientEmails: recipients.slice(0, 200),
      suppressedRecipientsCount: suppressedEmails.size + suppressedSignals.size,
      subject: `Following up: ${emailChannel?.previewText || blast.title}`.slice(0, 180),
      message: `Hi, I wanted to send this back to the top of your inbox in case it is helpful.\n\n${blast.title}`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/blasts/:id/engagement-tasks', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    await requireBlast(req.agentId, req.params.id);
    const parsed = z.object({ limit: z.number().int().min(1).max(100).default(25) }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const result = await createEngagementTasksForBlast({
      agentId: req.agentId,
      blastId: req.params.id,
      limit: parsed.data.limit,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/roi/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, deliveryLogs, marketingTasks] = await Promise.all([
      prisma.marketingEmailEvent.findMany({
        where: { agentId: req.agentId, occurredAt: { gte: since } },
        select: { blastId: true, email: true, eventType: true, occurredAt: true },
      }),
      prisma.marketingDeliveryLog.findMany({
        where: { agentId: req.agentId, createdAt: { gte: since } },
        select: { blastId: true, recipientsCount: true, status: true, subject: true, createdAt: true },
      }),
      prisma.task.count({
        where: {
          agentId: req.agentId,
          marketingBlastId: { not: null },
          createdAt: { gte: since },
        },
      }),
    ]);

    const byType: Record<string, number> = {};
    const engagedEmails = new Set<string>();
    const uniqueRecipients = new Set<string>();
    const campaignStats = new Map<string, { delivered: number; opens: number; clicks: number; replies: number; uniqueEngaged: Set<string>; lastEventAt: Date | null }>();

    for (const event of events) {
      const eventType = (event.eventType || 'UNKNOWN').toUpperCase();
      byType[eventType] = (byType[eventType] || 0) + 1;
      const email = normalizeRecipientEmail(event.email);
      if (email) uniqueRecipients.add(email);

      if (event.blastId) {
        if (!campaignStats.has(event.blastId)) {
          campaignStats.set(event.blastId, { delivered: 0, opens: 0, clicks: 0, replies: 0, uniqueEngaged: new Set(), lastEventAt: null });
        }
        const stats = campaignStats.get(event.blastId)!;
        if (eventType === 'DELIVERED') stats.delivered += 1;
        if (eventType === 'OPEN') stats.opens += 1;
        if (eventType === 'CLICK') stats.clicks += 1;
        if (eventType === 'INBOUND_REPLY') stats.replies += 1;
        if (MARKETING_ENGAGEMENT_EVENT_TYPES.includes(eventType) && email) stats.uniqueEngaged.add(email);
        if (!stats.lastEventAt || event.occurredAt > stats.lastEventAt) stats.lastEventAt = event.occurredAt;
      }

      if (email && MARKETING_ENGAGEMENT_EVENT_TYPES.includes(eventType)) engagedEmails.add(email);
    }

    const clientMatches = engagedEmails.size > 0
      ? await prisma.client.findMany({
          where: { agentId: req.agentId, email: { in: Array.from(engagedEmails) } },
          select: { id: true, email: true },
        })
      : [];
    const clientIds = clientMatches.map((client) => client.id);
    const associatedDeals = clientIds.length > 0
      ? await prisma.deal.findMany({
          where: {
            agentId: req.agentId,
            deletedAt: null,
            archivedAt: null,
            OR: [{ buyerId: { in: clientIds } }, { sellerId: { in: clientIds } }],
          },
          select: { id: true, status: true, repc: { select: { purchasePrice: true } } },
        })
      : [];

    const blastIds = Array.from(campaignStats.keys());
    const blastTitles = blastIds.length > 0
      ? await prisma.marketingBlast.findMany({
          where: { agentId: req.agentId, id: { in: blastIds } },
          select: { id: true, title: true, sentAt: true, createdAt: true },
        })
      : [];
    const blastTitleById = new Map(blastTitles.map((blast) => [blast.id, blast]));

    const recipientsCount = deliveryLogs.reduce((sum, log) => sum + (log.status === 'SENT' ? log.recipientsCount : 0), 0);
    const delivered = byType.DELIVERED || 0;
    const opens = byType.OPEN || 0;
    const clicks = byType.CLICK || 0;
    const replies = byType.INBOUND_REPLY || 0;
    const bounces = (byType.BOUNCE || 0) + (byType.BLOCKED || 0) + (byType.DROPPED || 0) + (byType.DEFERRED || 0);
    const activeDeals = associatedDeals.filter((deal) => !['CLOSED', 'FELL_THROUGH'].includes(deal.status)).length;
    const estimatedPipelineValue = associatedDeals.reduce((sum, deal) => sum + Number(deal.repc?.purchasePrice || 0), 0);

    const topCampaigns = Array.from(campaignStats.entries())
      .map(([blastId, stats]) => ({
        blastId,
        title: blastTitleById.get(blastId)?.title || 'Marketing campaign',
        sentAt: blastTitleById.get(blastId)?.sentAt || blastTitleById.get(blastId)?.createdAt || stats.lastEventAt,
        delivered: stats.delivered,
        opens: stats.opens,
        clicks: stats.clicks,
        replies: stats.replies,
        uniqueEngaged: stats.uniqueEngaged.size,
        engagementRate: calculateRate(stats.opens + stats.clicks + stats.replies, Math.max(stats.delivered, 1)),
      }))
      .sort((a, b) => b.uniqueEngaged - a.uniqueEngaged || b.clicks - a.clicks)
      .slice(0, 5);

    res.json({
      windowDays: days,
      totals: {
        campaignsSent: new Set(deliveryLogs.filter((log) => log.status === 'SENT').map((log) => log.blastId)).size,
        recipients: recipientsCount,
        delivered,
        opens,
        clicks,
        replies,
        bounces,
        uniqueEngaged: engagedEmails.size,
        followUpTasks: marketingTasks,
        engagedClientsWithDeals: clientMatches.length,
        activeDeals,
        estimatedPipelineValue,
      },
      rates: {
        deliveryRate: calculateRate(delivered, Math.max(recipientsCount, delivered + bounces)),
        openRate: calculateRate(opens, delivered),
        clickRate: calculateRate(clicks, delivered),
        replyRate: calculateRate(replies, delivered),
        bounceRate: calculateRate(bounces, Math.max(recipientsCount, delivered + bounces)),
      },
      topCampaigns,
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
