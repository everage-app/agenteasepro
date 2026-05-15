import { prisma } from '../lib/prisma';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export enum PriorityActionType {
  CONTRACT_DEADLINE = 'CONTRACT_DEADLINE',
  SIGNATURE_NEEDED = 'SIGNATURE_NEEDED',
  CLIENT_FOLLOWUP = 'CLIENT_FOLLOWUP',
  REFERRAL_TOUCH = 'REFERRAL_TOUCH',
  MARKETING_BLAST = 'MARKETING_BLAST',
  DAILY_GOAL = 'DAILY_GOAL',
}

export interface PriorityAction {
  id: string;
  type: PriorityActionType;
  title: string;
  description?: string;
  clientName?: string;
  dealOrListing?: string;
  dueDate?: Date;
  priority: 'HIGH' | 'NORMAL';
  status?: string;
  
  // Navigation helpers
  relatedId?: string;
  relatedType?: 'task' | 'deal' | 'client' | 'listing' | 'blast';
  
  // Quick action metadata
  actionLabel?: string;
  canComplete?: boolean;
  completionValue?: any;
}

/**
 * Priority Action Center v2: Aggregates daily actions from multiple sources
 * Inspired by Referral Maker CRM's action center
 */
export async function getTodayPriorityActions(agentId: string, forDate: Date = new Date()): Promise<PriorityAction[]> {
  const actions: PriorityAction[] = [];
  const today = startOfDay(forDate);
  const tomorrow = endOfDay(today);
  const next7Days = addDays(today, 7);

  // 1. CONTRACT DEADLINES (from DealEvents) - HIGHEST PRIORITY
  const upcomingDeadlines = await prisma.dealEvent.findMany({
    where: {
      agentId,
      date: {
        gte: today,
        lte: next7Days,
      },
      type: {
        in: ['DUE_DILIGENCE_DEADLINE', 'FINANCING_DEADLINE', 'SETTLEMENT_DEADLINE'],
      },
    },
    include: {
      deal: {
        include: { property: true },
      },
    },
    orderBy: { date: 'asc' },
    take: 3,
  });

  for (const deadline of upcomingDeadlines) {
    const isUrgent = deadline.date <= tomorrow;
    actions.push({
      id: `deadline-${deadline.id}`,
      type: PriorityActionType.CONTRACT_DEADLINE,
      title: deadline.title,
      description: deadline.description || undefined,
      dealOrListing: deadline.deal.property
        ? `${deadline.deal.property.street}, ${deadline.deal.property.city}`
        : deadline.deal.title,
      dueDate: deadline.date,
      priority: isUrgent ? 'HIGH' : 'NORMAL',
      relatedId: deadline.dealId,
      relatedType: 'deal',
      actionLabel: 'View deal',
      canComplete: false,
    });
  }

  // 2. OVERDUE TASKS - HIGH PRIORITY
  const overdueTasks = await prisma.task.findMany({
    where: {
      agentId,
      status: 'OPEN',
      dueAt: {
        lt: today,
      },
    },
    include: {
      client: true,
      deal: true,
      listing: true,
    },
    orderBy: { dueAt: 'asc' },
    take: 5,
  });

  for (const task of overdueTasks) {
    const clientName = task.client
      ? `${task.client.firstName} ${task.client.lastName}`
      : undefined;

    actions.push({
      id: `task-${task.id}`,
      type: task.category === 'CALL' || task.category === 'NOTE' || task.category === 'POPBY'
        ? PriorityActionType.REFERRAL_TOUCH
        : PriorityActionType.CLIENT_FOLLOWUP,
      title: `⚠️ OVERDUE: ${task.title}`,
      description: task.description || undefined,
      clientName,
      dealOrListing: task.deal?.title || task.listing?.addressLine1,
      dueDate: task.dueAt || undefined,
      priority: 'HIGH',
      status: task.status,
      relatedId: task.id,
      relatedType: 'task',
      actionLabel: 'Complete task',
      canComplete: true,
      completionValue: { status: 'COMPLETED' },
    });
  }

  // 3. TODAY'S TASKS (due today)
  const todayTasks = await prisma.task.findMany({
    where: {
      agentId,
      status: 'OPEN',
      dueAt: {
        gte: today,
        lte: tomorrow,
      },
    },
    include: {
      client: true,
      deal: true,
      listing: true,
    },
    orderBy: { dueAt: 'asc' },
    take: 5,
  });

  for (const task of todayTasks) {
    const clientName = task.client
      ? `${task.client.firstName} ${task.client.lastName}`
      : undefined;

    actions.push({
      id: `task-${task.id}`,
      type: task.category === 'CALL' || task.category === 'NOTE' || task.category === 'POPBY'
        ? PriorityActionType.REFERRAL_TOUCH
        : PriorityActionType.CLIENT_FOLLOWUP,
      title: task.title,
      description: task.description || undefined,
      clientName,
      dealOrListing: task.deal?.title || task.listing?.addressLine1,
      dueDate: task.dueAt || undefined,
      priority: 'NORMAL',
      status: task.status,
      relatedId: task.id,
      relatedType: 'task',
      actionLabel: task.category,
      canComplete: true,
      completionValue: { status: 'COMPLETED' },
    });
  }

  // 4. CLIENTS NEEDING TOUCHPOINTS (last contact > 30 days ago, A/B rank)
  const staleClients = await prisma.client.findMany({
    where: {
      agentId,
      referralRank: { in: ['A', 'B'] },
      lastContactAt: {
        lt: addDays(today, -30),
      },
    },
    orderBy: { lastContactAt: 'asc' },
    take: 3,
  });

  for (const client of staleClients) {
    const daysSinceContact = client.lastContactAt
      ? Math.floor((today.getTime() - client.lastContactAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    actions.push({
      id: `client-followup-${client.id}`,
      type: PriorityActionType.REFERRAL_TOUCH,
      title: `Touch base with ${client.firstName} ${client.lastName}`,
      description: `Last contact: ${daysSinceContact} days ago • ${client.referralRank} rank referral source`,
      clientName: `${client.firstName} ${client.lastName}`,
      priority: daysSinceContact > 60 ? 'HIGH' : 'NORMAL',
      relatedId: client.id,
      relatedType: 'client',
      actionLabel: 'Contact client',
      canComplete: false,
    });
  }

  // 5. MARKETING BLASTS SCHEDULED TODAY
  const todayBlasts = await prisma.marketingBlast.findMany({
    where: {
      agentId,
      scheduledAt: {
        gte: today,
        lte: tomorrow,
      },
      status: 'SCHEDULED',
    },
    include: {
      listing: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });

  for (const blast of todayBlasts) {
    actions.push({
      id: `blast-${blast.id}`,
      type: PriorityActionType.MARKETING_BLAST,
      title: `📢 ${blast.title}`,
      description: `${blast.playbook} blast scheduled to send`,
      dealOrListing: blast.listing?.addressLine1,
      dueDate: blast.scheduledAt || undefined,
      priority: 'NORMAL',
      status: blast.status,
      relatedId: blast.id,
      relatedType: 'blast',
      actionLabel: 'Review blast',
      canComplete: false,
    });
  }

  // 6. DAILY ACTIVITY GOALS (from Win the Day widget)
  const dailyActivity = await prisma.dailyActivity.findUnique({
    where: {
      agentId_date: {
        agentId,
        date: today,
      },
    },
  });

  if (dailyActivity) {
    const goals = [
      {
        id: 'calls',
        title: 'Make calls',
        current: dailyActivity.callsMade,
        goal: dailyActivity.callsGoal,
      },
      {
        id: 'notes',
        title: 'Send notes',
        current: dailyActivity.notesSent,
        goal: dailyActivity.notesGoal,
      },
      {
        id: 'popbys',
        title: 'Do pop-bys',
        current: dailyActivity.popbysDone,
        goal: dailyActivity.popbysGoal,
      },
      {
        id: 'referrals',
        title: 'Ask for referrals',
        current: dailyActivity.referralsAsked,
        goal: dailyActivity.referralsAskedGoal,
      },
    ];

    for (const goalItem of goals) {
      if (goalItem.current < goalItem.goal) {
        const remaining = goalItem.goal - goalItem.current;
        actions.push({
          id: `goal-${goalItem.id}`,
          type: PriorityActionType.DAILY_GOAL,
          title: `${goalItem.title} (${remaining} left)`,
          description: `Daily goal: ${goalItem.current}/${goalItem.goal}`,
          priority: 'NORMAL',
          relatedId: dailyActivity.id,
          relatedType: 'task',
          actionLabel: `+1 ${goalItem.id}`,
          canComplete: true,
          completionValue: { field: goalItem.id, increment: 1 },
        });
      }
    }
  }

  // Sort: HIGH priority first, then by date
  return actions.sort((a, b) => {
    if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
    if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    return 0;
  });
}

/**
 * Complete a priority action (mark task done, increment goal, etc.)
 */
export async function completePriorityAction(
  agentId: string,
  actionId: string,
  actionType: PriorityActionType,
  completionValue?: any
): Promise<void> {
  // Parse the action ID to determine what to update
  if (actionId.startsWith('task-')) {
    const taskId = actionId.replace('task-', '');
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
    });
  } else if (actionId.startsWith('goal-')) {
    const goalField = actionId.replace('goal-', '');
    const today = startOfDay(new Date());
    
    // Increment the daily activity field
    const fieldMap: Record<string, string> = {
      calls: 'callsMade',
      notes: 'notesSent',
      popbys: 'popbysDone',
      referrals: 'referralsAsked',
    };

    const dbField = fieldMap[goalField];
    if (dbField) {
      await prisma.dailyActivity.update({
        where: {
          agentId_date: { agentId, date: today },
        },
        data: {
          [dbField]: { increment: 1 },
        },
      });
    }
  }
}
