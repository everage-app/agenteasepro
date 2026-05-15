import { prisma } from '../lib/prisma';
import type { AutomationRuleConfig } from './types';

/**
 * Seed default automation rules for an agent
 */
export async function seedDefaultAutomationRules(agentId: string): Promise<void> {
  console.log(`[Automation] Seeding default rules for agent ${agentId}`);

  // Check if agent already has rules
  const existingRules = await prisma.automationRule.count({
    where: { agentId },
  });

  if (existingRules > 0) {
    console.log(`[Automation] Agent already has ${existingRules} rules, skipping seed`);
    return;
  }

  const defaultRules: Array<{
    name: string;
    eventType: any;
    config: AutomationRuleConfig;
    isEnabled: boolean;
  }> = [
    {
      name: 'New Listing → Auto-create Marketing Tasks',
      eventType: 'LISTING_CREATED',
      config: {
        actions: [{ action: 'CREATE_TASKS', template: 'NEW_LISTING_DEFAULT', useAI: false }],
      },
      isEnabled: true,
    },
    {
      name: 'New Listing → AI-Enhanced Task Suggestions',
      eventType: 'LISTING_CREATED',
      config: {
        actions: [{ action: 'CREATE_TASKS', template: 'NEW_LISTING_AI', useAI: true }],
      },
      isEnabled: false, // Disabled by default until user adds OpenAI key
    },
    {
      name: 'New Deal/REPC → Key Date Tasks',
      eventType: 'DEAL_CREATED',
      config: {
        actions: [{ action: 'SCHEDULE_DEAL_TASKS', useKeyDates: true, useAI: false }],
      },
      isEnabled: true,
    },
    {
      name: 'New Deal/REPC → AI-Enhanced Contract Tasks',
      eventType: 'DEAL_CREATED',
      config: {
        actions: [{ action: 'SCHEDULE_DEAL_TASKS', useKeyDates: true, useAI: true }],
      },
      isEnabled: false,
    },
    {
      name: 'Marketing Blast Sent → Follow-up Tasks',
      eventType: 'MARKETING_BLAST_SENT',
      config: {
        actions: [{ action: 'CREATE_TASKS', template: 'BLAST_FOLLOWUP' }],
      },
      isEnabled: true,
    },
    {
      name: 'Client → Past Client → Referral Touch Sequence',
      eventType: 'CLIENT_STAGE_CHANGED',
      config: {
        actions: [
          {
            action: 'CREATE_REFERRAL_TOUCH_SEQUENCE',
            sequenceType: 'PAST_CLIENT',
          },
        ],
      },
      isEnabled: true,
    },
  ];

  for (const rule of defaultRules) {
    await prisma.automationRule.create({
      data: {
        agentId,
        name: rule.name,
        eventType: rule.eventType,
        config: rule.config as any,
        isEnabled: rule.isEnabled,
      },
    });
  }

  console.log(`[Automation] Created ${defaultRules.length} default automation rules`);
}

/**
 * Get all automation rules for an agent
 */
export async function getAutomationRules(agentId: string) {
  return prisma.automationRule.findMany({
    where: { agentId },
    orderBy: [{ eventType: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Toggle automation rule on/off
 */
export async function toggleAutomationRule(
  ruleId: string,
  agentId: string,
  isEnabled: boolean
) {
  return prisma.automationRule.update({
    where: { id: ruleId, agentId },
    data: { isEnabled },
  });
}

export async function updateAutomationRule(
  ruleId: string,
  agentId: string,
  data: { name?: string; config?: AutomationRuleConfig }
) {
  return prisma.automationRule.update({
    where: { id: ruleId, agentId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.config !== undefined && { config: data.config as any }),
    },
  });
}
