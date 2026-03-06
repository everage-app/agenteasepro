/**
 * Lead Routing Service — automatic lead assignment for teams.
 *
 * Supports:
 *   - ROUND_ROBIN: next available agent in rotation
 *   - WEIGHTED:    proportional to weight values
 *   - ZIP_CODE:    geographic territory assignment
 *   - SOURCE:      route by lead source (Zillow → Agent A, etc.)
 *   - MANUAL:      no auto-assignment (default)
 *
 * Uses the `LeadRoutingRule` Prisma model added in the schema.
 */
import { prisma } from '../lib/prisma';

export type RoutingStrategy = 'ROUND_ROBIN' | 'WEIGHTED' | 'ZIP_CODE' | 'SOURCE' | 'MANUAL';

interface RoutingContext {
  teamId: string;
  leadSource?: string;
  leadZip?: string;
}

/**
 * Determine which agent should receive a new lead based on the team's routing rules.
 * Returns the agentId to assign, or null if no rule matches (manual routing).
 */
export async function routeLead(ctx: RoutingContext): Promise<string | null> {
  const rules = await prisma.leadRoutingRule.findMany({
    where: { teamId: ctx.teamId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  if (rules.length === 0) return null;

  for (const rule of rules) {
    const strategy = rule.strategy as RoutingStrategy;
    const conditions = rule.conditions as Record<string, any> | null;

    switch (strategy) {
      case 'ZIP_CODE': {
        if (!ctx.leadZip) continue;
        const zipMap = conditions?.zipCodes as Record<string, string> | undefined;
        const agentId = zipMap?.[ctx.leadZip];
        if (agentId) return agentId;
        continue;
      }

      case 'SOURCE': {
        if (!ctx.leadSource) continue;
        const srcMap = conditions?.sources as Record<string, string> | undefined;
        const agentId = srcMap?.[ctx.leadSource];
        if (agentId) return agentId;
        continue;
      }

      case 'ROUND_ROBIN': {
        const pool = rule.assigneeIds;
        if (pool.length === 0) continue;

        const nextIdx = (rule.currentIndex + 1) % pool.length;

        // Update index atomically
        await prisma.leadRoutingRule.update({
          where: { id: rule.id },
          data: { currentIndex: nextIdx },
        });

        return pool[nextIdx];
      }

      case 'WEIGHTED': {
        const weights = rule.weights as Record<string, number> | null;
        if (!weights) continue;

        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        if (total === 0) continue;

        const rand = Math.random() * total;
        let cumulative = 0;
        for (const [agentId, weight] of entries) {
          cumulative += weight;
          if (rand <= cumulative) return agentId;
        }
        return entries[entries.length - 1][0]; // fallback
      }

      case 'MANUAL':
      default:
        continue;
    }
  }

  return null;
}

/**
 * Helper to auto-assign a lead if a routing rule exists for the lead's team context.
 */
export async function autoAssignLead(leadId: string, teamId: string, leadSource?: string, leadZip?: string): Promise<string | null> {
  const agentId = await routeLead({ teamId, leadSource, leadZip });
  if (!agentId) return null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedTo: agentId },
  });

  return agentId;
}
