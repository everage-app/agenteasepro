import { Prisma } from '@prisma/client';
import type { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getOwnerConfig, isMasterOwnerEmail, normalizeOwnerEmail } from '../lib/ownerConfig';
import { extractIp } from './securityAuditService';

export type InternalRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'BILLING' | 'SALES' | 'PRODUCT' | 'ENGINEERING' | 'READ_ONLY';

type AuditInput = {
  req?: AuthenticatedRequest;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

type AgentHealthOptions = {
  agentIds?: string[];
  take?: number;
  includeArchived?: boolean;
};

const OWNER_ROLES = new Set<InternalRole>(['OWNER', 'ADMIN']);
const STAFF_ROLES = new Set<InternalRole>(['OWNER', 'ADMIN', 'SUPPORT', 'BILLING', 'SALES', 'PRODUCT', 'ENGINEERING', 'READ_ONLY']);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(now: Date, value?: Date | string | null) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.floor((now.getTime() - time) / (24 * 60 * 60 * 1000));
}

function countMap(rows: Array<{ agentId: string | null; _count?: any }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.agentId) continue;
    const count = typeof row._count === 'number' ? row._count : Number(row._count?._all || row._count?.agentId || 0);
    map.set(row.agentId, count);
  }
  return map;
}

export function supportDueAtForPriority(priority?: string | null, createdAt = new Date()) {
  const hours = priority === 'URGENT' ? 4 : priority === 'HIGH' ? 24 : priority === 'LOW' ? 96 : 48;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export async function getInternalAccessForRequest(req: AuthenticatedRequest) {
  const ownerConfig = getOwnerConfig();
  const { configured } = ownerConfig;
  if (!req.agentId) {
    return { allowed: false, configured, isOwner: false, isMasterOwner: false, role: null as InternalRole | null, staff: null as any };
  }

  const [agent, staff] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: req.agentId },
      select: { id: true, email: true, name: true, status: true },
    }),
    prisma.internalStaff.findUnique({
      where: { agentId: req.agentId },
      select: { id: true, role: true, title: true, active: true, lastAccessAt: true },
    }).catch(() => null),
  ]);

  const normalizedAgentEmail = agent?.email ? normalizeOwnerEmail(agent.email) : null;
  const isMasterOwner = Boolean(agent?.email && isMasterOwnerEmail(agent.email));
  const isOwner = Boolean(
    agent && (
      ownerConfig.ownerIds.has(agent.id) ||
      (normalizedAgentEmail && ownerConfig.ownerEmails.has(normalizedAgentEmail))
    ),
  );
  const staffActive = Boolean(staff?.active && STAFF_ROLES.has(staff.role as InternalRole));
  const allowed = isOwner || staffActive;
  const role = isOwner ? (isMasterOwner ? 'OWNER' : 'ADMIN') : staffActive ? (staff?.role as InternalRole) : null;

  if (allowed) {
    prisma.internalStaff.upsert({
      where: { agentId: req.agentId },
      create: {
        agentId: req.agentId,
        role: role || 'READ_ONLY',
        title: isMasterOwner ? 'Master owner' : isOwner ? 'Owner admin' : staff?.title,
        active: true,
        lastAccessAt: new Date(),
      },
      update: {
        ...(isOwner ? { role: role || 'ADMIN', title: isMasterOwner ? 'Master owner' : 'Owner admin', active: true } : {}),
        lastAccessAt: new Date(),
      },
    }).catch(() => {});
  }

  return { allowed, configured, isOwner, isMasterOwner, role, staff };
}

export function roleCanManage(role: InternalRole | null, capability: 'staff' | 'billing' | 'support' | 'sales' | 'system') {
  if (!role) return false;
  if (OWNER_ROLES.has(role)) return true;
  if (capability === 'support') return ['SUPPORT', 'PRODUCT', 'ENGINEERING'].includes(role);
  if (capability === 'billing') return role === 'BILLING';
  if (capability === 'sales') return role === 'SALES';
  if (capability === 'system') return role === 'ENGINEERING';
  return false;
}

export async function writeInternalAudit(input: AuditInput) {
  const req = input.req;
  const data: any = {
    actorAgentId: req?.agentId || null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId || null,
    summary: input.summary,
    reason: input.reason || null,
    requestId: req?.requestId || null,
    ip: req ? extractIp(req) : null,
    userAgent: req?.get?.('user-agent') || null,
  };

  if (typeof input.before !== 'undefined') data.before = input.before as Prisma.InputJsonValue;
  if (typeof input.after !== 'undefined') data.after = input.after as Prisma.InputJsonValue;

  await Promise.allSettled([
    prisma.internalAuditLog.create({ data }),
    prisma.internalEvent.create({
      data: {
        agentId: req?.agentId || null,
        kind: `internal:${input.action}`,
        path: `${input.targetType}${input.targetId ? `:${input.targetId}` : ''}`,
        meta: {
          summary: input.summary,
          targetType: input.targetType,
          targetId: input.targetId || null,
          reason: input.reason || null,
        },
      },
    }),
  ]);
}

export async function buildAgentHealthProfiles(options: AgentHealthOptions = {}) {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const where: Prisma.AgentWhereInput = {
    ...(options.agentIds?.length ? { id: { in: options.agentIds } } : {}),
    ...(options.includeArchived ? {} : { status: { not: 'REVOKED' } }),
  };

  const agents = await prisma.agent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.agentIds?.length ? undefined : options.take || 100,
    select: {
      id: true,
      email: true,
      name: true,
      brokerageName: true,
      licenseNumber: true,
      status: true,
      subscriptionStatus: true,
      billingMode: true,
      billingAccessOverride: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
      profileSettings: { select: { phone: true, websiteUrl: true, brokerageLogoUrl: true } },
      idxConnection: { select: { id: true } },
      googleCalendar: { select: { id: true, syncEnabled: true } },
      channelConnections: { select: { type: true, config: true } },
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

  const agentIds = agents.map((agent) => agent.id);
  if (!agentIds.length) return [];

  const [events, errors7, supportRows, leadMailTotal, leadMailReady, clientMailTotal, clientMailReady] = await Promise.all([
    prisma.internalEvent.findMany({
      where: { agentId: { in: agentIds }, createdAt: { gte: since30 } },
      orderBy: { createdAt: 'desc' },
      take: 8000,
      select: { agentId: true, createdAt: true },
    }),
    prisma.internalError.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, createdAt: { gte: since7 } },
      _count: { _all: true },
    }),
    prisma.supportRequest.findMany({
      where: { agentId: { in: agentIds }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { agentId: true, priority: true, status: true, dueAt: true, createdAt: true },
    }),
    prisma.lead.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['agentId'],
      where: {
        agentId: { in: agentIds },
        deletedAt: null,
        mailingAddress: { not: null },
        mailingCity: { not: null },
        mailingZip: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.client.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.client.groupBy({
      by: ['agentId'],
      where: {
        agentId: { in: agentIds },
        deletedAt: null,
        mailingAddress: { not: null },
        mailingCity: { not: null },
        mailingZip: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const lastActive = new Map<string, Date>();
  const eventCounts30 = new Map<string, number>();
  const eventCounts14 = new Map<string, number>();
  for (const event of events) {
    if (!event.agentId) continue;
    if (!lastActive.has(event.agentId)) lastActive.set(event.agentId, event.createdAt);
    eventCounts30.set(event.agentId, (eventCounts30.get(event.agentId) || 0) + 1);
    if (event.createdAt >= since14) eventCounts14.set(event.agentId, (eventCounts14.get(event.agentId) || 0) + 1);
  }

  const errors7Map = countMap(errors7 as any);
  const leadTotalMap = countMap(leadMailTotal as any);
  const leadReadyMap = countMap(leadMailReady as any);
  const clientTotalMap = countMap(clientMailTotal as any);
  const clientReadyMap = countMap(clientMailReady as any);

  const supportMap = new Map<string, { open: number; urgent: number; overdue: number }>();
  for (const row of supportRows) {
    const current = supportMap.get(row.agentId) || { open: 0, urgent: 0, overdue: 0 };
    current.open += 1;
    if (row.priority === 'URGENT' || row.priority === 'HIGH') current.urgent += 1;
    const dueAt = row.dueAt || supportDueAtForPriority(row.priority, row.createdAt);
    if (dueAt < now) current.overdue += 1;
    supportMap.set(row.agentId, current);
  }

  return agents.map((agent) => {
    const channelTypes = new Set(agent.channelConnections.map((connection) => connection.type));
    const setupChecks = [
      Boolean(agent.name && agent.email),
      Boolean(agent.brokerageName || agent.profileSettings?.phone),
      Boolean(agent.licenseNumber),
      Boolean(agent.termsAcceptedAt && agent.privacyAcceptedAt),
      Boolean(agent.idxConnection || channelTypes.has('WEBSITE')),
      Boolean(agent.googleCalendar?.syncEnabled || channelTypes.has('EMAIL')),
      agent._count.clients > 0 || agent._count.leads > 0,
      agent._count.deals > 0 || agent._count.tasks > 0,
      agent._count.landingPages > 0 || agent._count.marketingBlasts > 0,
    ];
    const setupScore = Math.round((setupChecks.filter(Boolean).length / setupChecks.length) * 100);

    const totalMailing = (leadTotalMap.get(agent.id) || 0) + (clientTotalMap.get(agent.id) || 0);
    const readyMailing = (leadReadyMap.get(agent.id) || 0) + (clientReadyMap.get(agent.id) || 0);
    const mailingReadinessPct = totalMailing > 0 ? Math.round((readyMailing / totalMailing) * 100) : 0;
    const support = supportMap.get(agent.id) || { open: 0, urgent: 0, overdue: 0 };
    const lastActiveAt = lastActive.get(agent.id) || null;
    const daysInactive = daysBetween(now, lastActiveAt) ?? daysBetween(now, agent.createdAt) ?? 999;
    const hasBusinessData = agent._count.leads + agent._count.clients + agent._count.deals + agent._count.listings + agent._count.tasks > 0;
    const errors = errors7Map.get(agent.id) || 0;

    const reasons: string[] = [];
    let riskScore = 0;

    if (agent.status !== 'ACTIVE') {
      riskScore += agent.status === 'SUSPENDED' ? 35 : 60;
      reasons.push(`Account status is ${agent.status.toLowerCase()}`);
    }
    if (agent.subscriptionStatus === 'PAST_DUE') {
      riskScore += 35;
      reasons.push('Billing is past due');
    } else if (agent.subscriptionStatus === 'CANCELED') {
      riskScore += 50;
      reasons.push('Subscription is canceled');
    } else if (agent.subscriptionStatus === 'TRIAL' && daysBetween(now, agent.createdAt)! >= 5) {
      riskScore += 18;
      reasons.push('Trial is nearing conversion point');
    }
    if (daysInactive >= 30) {
      riskScore += 35;
      reasons.push('No captured activity in 30+ days');
    } else if (daysInactive >= 14) {
      riskScore += 22;
      reasons.push('No captured activity in 14+ days');
    } else if ((eventCounts14.get(agent.id) || 0) < 3) {
      riskScore += 10;
      reasons.push('Low recent usage');
    }
    if (!hasBusinessData) {
      riskScore += 20;
      reasons.push('No leads, clients, deals, listings, or tasks yet');
    }
    if (setupScore < 55) {
      riskScore += 16;
      reasons.push('Setup is incomplete');
    }
    if (support.urgent > 0) {
      riskScore += 18;
      reasons.push('High-priority support is open');
    }
    if (support.overdue > 0) {
      riskScore += 12;
      reasons.push('Support SLA is overdue');
    }
    if (errors > 0) {
      riskScore += Math.min(18, errors * 4);
      reasons.push(`${errors} app error${errors === 1 ? '' : 's'} in the last 7 days`);
    }

    riskScore = clamp(riskScore);
    const activityScore = clamp(Math.min(100, (eventCounts30.get(agent.id) || 0) * 4 + (hasBusinessData ? 35 : 0)));
    const billingScore = agent.subscriptionStatus === 'ACTIVE' || agent.billingMode === 'FREE' || agent.billingAccessOverride
      ? 100
      : agent.subscriptionStatus === 'TRIAL'
        ? 75
        : agent.subscriptionStatus === 'PAST_DUE'
          ? 30
          : 10;
    const supportScore = support.overdue > 0 ? 35 : support.urgent > 0 ? 55 : support.open > 0 ? 75 : 100;
    const healthScore = clamp(Math.round(setupScore * 0.32 + activityScore * 0.26 + billingScore * 0.25 + supportScore * 0.17 - riskScore * 0.18));

    const healthStatus = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'watch' : healthScore >= 40 ? 'at_risk' : 'critical';
    const riskLevel = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
    const nextBestAction = reasons[0]
      ? reasons[0].includes('Billing') || reasons[0].includes('Subscription')
        ? 'Contact agent about billing and restore payment confidence.'
        : reasons[0].includes('activity') || reasons[0].includes('usage')
          ? 'Send a personal check-in and offer a quick onboarding call.'
          : reasons[0].includes('support') || reasons[0].includes('SLA')
            ? 'Resolve the open support item before asking for more engagement.'
            : 'Guide this account through the next setup milestone.'
      : 'Ask for a testimonial, referral, or product feedback while momentum is high.';

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        brokerageName: agent.brokerageName,
        licenseNumber: agent.licenseNumber,
        status: agent.status,
        subscriptionStatus: agent.subscriptionStatus,
        billingMode: agent.billingMode,
        billingAccessOverride: agent.billingAccessOverride,
        createdAt: agent.createdAt,
      },
      counts: agent._count,
      healthScore,
      setupScore,
      activityScore,
      billingScore,
      supportScore,
      riskScore,
      healthStatus,
      riskLevel,
      lastActiveAt,
      daysInactive,
      recentEvents30d: eventCounts30.get(agent.id) || 0,
      recentErrors7d: errors,
      support,
      mailing: {
        total: totalMailing,
        ready: readyMailing,
        readinessPct: mailingReadinessPct,
      },
      setup: {
        complete: setupChecks.filter(Boolean).length,
        total: setupChecks.length,
      },
      reasons: reasons.slice(0, 5),
      nextBestAction,
    };
  }).sort((a, b) => b.riskScore - a.riskScore || a.healthScore - b.healthScore);
}

export async function buildOwnerBriefing() {
  const now = new Date();
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const profiles = await buildAgentHealthProfiles({ take: 250 });

  const [openSupport, overdueSupport, urgentSupport, systemErrors24h, staffCount, auditRows] = await Promise.all([
    prisma.supportRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, agent: { status: { not: 'REVOKED' } } } }),
    prisma.supportRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lt: now }, agent: { status: { not: 'REVOKED' } } } }),
    prisma.supportRequest.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, priority: { in: ['HIGH', 'URGENT'] }, agent: { status: { not: 'REVOKED' } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 8,
      include: { agent: { select: { id: true, name: true, email: true, brokerageName: true } }, assignedToAgent: { select: { id: true, name: true, email: true } } },
    }),
    prisma.internalError.count({ where: { createdAt: { gte: since24 }, OR: [{ agentId: null }, { agent: { status: { not: 'REVOKED' } } }] } }),
    prisma.internalStaff.count({ where: { active: true } }).catch(() => 0),
    prisma.internalAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }).catch(() => []),
  ]);

  const highRisk = profiles.filter((profile) => profile.riskLevel === 'high' || profile.riskLevel === 'critical').slice(0, 10);
  const onboarding = profiles.filter((profile) => profile.setupScore < 70 && profile.agent.status === 'ACTIVE').slice(0, 10);
  const billingRecovery = profiles.filter((profile) => {
    if (profile.agent.billingMode === 'FREE') return false;
    if (profile.agent.subscriptionStatus === 'PAST_DUE' || profile.agent.subscriptionStatus === 'CANCELED') return true;
    return profile.agent.subscriptionStatus === 'TRIAL' && daysBetween(now, profile.agent.createdAt)! >= 5;
  }).slice(0, 10);
  const powerUsers = profiles.filter((profile) => profile.healthScore >= 80 && profile.riskScore < 20).slice(-10).reverse();

  const avgHealth = profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.healthScore, 0) / profiles.length) : 0;
  const active24h = profiles.filter((profile) => profile.daysInactive <= 1).length;

  return {
    generatedAt: now.toISOString(),
    kpis: {
      avgHealth,
      highRiskAgents: highRisk.length,
      activeAgents24h: active24h,
      openSupport,
      overdueSupport,
      systemErrors24h,
      internalStaff: staffCount,
    },
    queues: {
      churnRisk: highRisk,
      onboarding,
      billingRecovery,
      urgentSupport,
      powerUsers,
    },
    audit: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      summary: row.summary,
      createdAt: row.createdAt,
      actor: row.actor,
    })),
    recommendedActions: [
      overdueSupport > 0 ? `${overdueSupport} support SLA${overdueSupport === 1 ? ' is' : 's are'} overdue.` : null,
      billingRecovery.length > 0 ? `${billingRecovery.length} account${billingRecovery.length === 1 ? '' : 's'} need billing/trial follow-up.` : null,
      highRisk.length > 0 ? `${highRisk.length} agent${highRisk.length === 1 ? '' : 's'} are high churn risk.` : null,
      systemErrors24h > 0 ? `${systemErrors24h} production error${systemErrors24h === 1 ? '' : 's'} captured in 24h.` : null,
    ].filter(Boolean),
  };
}

export async function listInternalStaff() {
  return prisma.internalStaff.findMany({
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { updatedAt: 'desc' }],
    include: { agent: { select: { id: true, name: true, email: true, status: true, createdAt: true } } },
  });
}

export async function upsertInternalStaff(input: {
  agentId: string;
  role: InternalRole;
  active?: boolean;
  title?: string | null;
  notes?: string | null;
}) {
  return prisma.internalStaff.upsert({
    where: { agentId: input.agentId },
    create: {
      agentId: input.agentId,
      role: input.role,
      active: input.active ?? true,
      title: input.title || null,
      notes: input.notes || null,
    },
    update: {
      role: input.role,
      active: input.active ?? true,
      title: input.title || null,
      notes: input.notes || null,
    },
    include: { agent: { select: { id: true, name: true, email: true, status: true } } },
  });
}

export async function listInternalAuditLogs(options: { page: number; pageSize: number; q?: string; action?: string }) {
  const where: Prisma.InternalAuditLogWhereInput = {
    ...(options.action ? { action: options.action } : {}),
    ...(options.q ? {
      OR: [
        { action: { contains: options.q, mode: 'insensitive' } },
        { targetType: { contains: options.q, mode: 'insensitive' } },
        { targetId: { contains: options.q, mode: 'insensitive' } },
        { summary: { contains: options.q, mode: 'insensitive' } },
        { actor: { name: { contains: options.q, mode: 'insensitive' } } },
        { actor: { email: { contains: options.q, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.internalAuditLog.count({ where }),
    prisma.internalAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return { page: options.page, pageSize: options.pageSize, total, logs };
}