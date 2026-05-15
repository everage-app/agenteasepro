import { prisma } from '../lib/prisma';

export type LeadRoutingMode = 'MANUAL' | 'ASSIGN_TO_SELF' | 'LABEL';

export type LeadOpsSettings = {
  routingMode: LeadRoutingMode;
  assignedTo?: string;
  assignToSelf: boolean;
  assignToLabel?: string;
  followUpEnabled: boolean;
  followUpMinutes: number;
  warningMinutes: number;
  escalationAction: 'TASK_ONLY' | 'NOTIFY_AGENT';
  teamId?: string | null;
};

const VALID_ROUTING_MODES = new Set<LeadRoutingMode>(['MANUAL', 'ASSIGN_TO_SELF', 'LABEL']);

function clampMinutes(value: unknown, fallback: number, min = 5, max = 1440) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

function normalizeRoutingMode(value: unknown, fallback: LeadRoutingMode): LeadRoutingMode {
  const mode = String(value || '').toUpperCase() as LeadRoutingMode;
  return VALID_ROUTING_MODES.has(mode) ? mode : fallback;
}

export function buildLeadOpsTags(settings: LeadOpsSettings) {
  return [
    settings.followUpEnabled ? `SLA:${settings.followUpMinutes}m` : null,
    settings.routingMode !== 'MANUAL' ? 'ROUTING:auto' : 'ROUTING:manual',
  ].filter(Boolean) as string[];
}

export async function getLeadOpsSettings(agentId: string): Promise<LeadOpsSettings> {
  const [connection, agent] = await Promise.all([
    prisma.agentChannelConnection.findUnique({
      where: { agentId_type: { agentId, type: 'WEBSITE' } },
    }),
    prisma.agent.findUnique({
      where: { id: agentId },
      select: { teamId: true },
    }),
  ]);

  const teamId = agent?.teamId || null;
  const teamSla = teamId
    ? await prisma.leadSLA.findFirst({ where: { teamId }, orderBy: { updatedAt: 'desc' } })
    : null;

  const config = (connection?.config || {}) as Record<string, any>;
  const followUpMinutes = clampMinutes(config.slaMinutes ?? config.followUpMinutes, teamSla?.minutesToAccept || 15);
  const warningMinutes = Math.min(
    followUpMinutes,
    clampMinutes(config.slaWarningMinutes, teamSla?.warningMinutes || Math.max(5, followUpMinutes - 5), 5, followUpMinutes),
  );
  const assignToSelf = Boolean(config.assignToSelf ?? true);
  const fallbackMode: LeadRoutingMode = assignToSelf ? 'ASSIGN_TO_SELF' : 'MANUAL';
  const routingMode = normalizeRoutingMode(config.routingMode, fallbackMode);
  const assignToLabel = String(config.assignToLabel || '').trim() || undefined;
  const assignedTo = routingMode === 'ASSIGN_TO_SELF'
    ? agentId
    : routingMode === 'LABEL'
      ? assignToLabel
      : undefined;

  return {
    routingMode,
    assignedTo,
    assignToSelf,
    assignToLabel,
    followUpEnabled: config.followUpEnabled !== false,
    followUpMinutes,
    warningMinutes,
    escalationAction: config.escalationAction === 'NOTIFY_AGENT' ? 'NOTIFY_AGENT' : 'TASK_ONLY',
    teamId,
  };
}

export async function saveLeadOpsSettings(agentId: string, input: Partial<LeadOpsSettings>) {
  const existing = await prisma.agentChannelConnection.findUnique({
    where: { agentId_type: { agentId, type: 'WEBSITE' } },
  });
  const existingConfig = (existing?.config || {}) as Record<string, any>;

  const followUpMinutes = clampMinutes(input.followUpMinutes, Number(existingConfig.followUpMinutes || 15));
  const warningMinutes = Math.min(
    followUpMinutes,
    clampMinutes(input.warningMinutes, Number(existingConfig.slaWarningMinutes || Math.max(5, followUpMinutes - 5)), 5, followUpMinutes),
  );
  const routingMode = normalizeRoutingMode(input.routingMode, 'ASSIGN_TO_SELF');
  const nextConfig = {
    ...existingConfig,
    routingMode,
    assignToSelf: input.assignToSelf ?? routingMode === 'ASSIGN_TO_SELF',
    assignToLabel: String(input.assignToLabel || '').trim() || undefined,
    followUpEnabled: input.followUpEnabled !== false,
    followUpMinutes,
    slaMinutes: followUpMinutes,
    slaWarningMinutes: warningMinutes,
    escalationAction: input.escalationAction === 'NOTIFY_AGENT' ? 'NOTIFY_AGENT' : 'TASK_ONLY',
  };

  await prisma.agentChannelConnection.upsert({
    where: { agentId_type: { agentId, type: 'WEBSITE' } },
    create: { agentId, type: 'WEBSITE', config: nextConfig },
    update: { config: nextConfig },
  });

  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { teamId: true } });
  if (agent?.teamId) {
    const existingSla = await prisma.leadSLA.findFirst({ where: { teamId: agent.teamId } });
    if (existingSla) {
      await prisma.leadSLA.update({
        where: { id: existingSla.id },
        data: {
          minutesToAccept: followUpMinutes,
          warningMinutes,
          breachAction: nextConfig.escalationAction,
        },
      });
    } else {
      await prisma.leadSLA.create({
        data: {
          teamId: agent.teamId,
          minutesToAccept: followUpMinutes,
          warningMinutes,
          breachAction: nextConfig.escalationAction,
        },
      });
    }
  }

  return getLeadOpsSettings(agentId);
}