import { prisma } from '../lib/prisma';
import {
  AutomationEventPayload,
  AutomationActionConfig,
  AutomationRuleConfig,
} from './types';
import { suggestListingTasks, suggestDealTasksFromDates } from './aiService';

/**
 * Main entry point for automation events
 */
export async function dispatchAutomationEvent(
  event: AutomationEventPayload
): Promise<void> {
  try {
    console.log(`[Automation] Dispatching event: ${event.type}`, event);

    // Load enabled automation rules for this agent and event type
    const rules = await prisma.automationRule.findMany({
      where: {
        agentId: event.agentId,
        eventType: event.type as any,
        isEnabled: true,
      },
    });

    console.log(`[Automation] Found ${rules.length} enabled rules`);

    // Execute each rule's actions
    for (const rule of rules) {
      try {
        const config = rule.config as unknown as AutomationRuleConfig;
        console.log(`[Automation] Executing rule: ${rule.name}`);

        for (const action of config.actions) {
          await executeAction(action, event);
        }
      } catch (error) {
        console.error(`[Automation] Error executing rule ${rule.name}:`, error);
        // Continue with other rules even if one fails
      }
    }
  } catch (error) {
    console.error('[Automation] Error dispatching event:', error);
  }
}

/**
 * Execute a single automation action
 */
async function executeAction(
  action: AutomationActionConfig,
  event: AutomationEventPayload
): Promise<void> {
  if ((action as any).enabled === false) {
    return;
  }
  switch (action.action) {
    case 'CREATE_TASKS':
      await handleCreateTasks(action, event);
      break;
    case 'CREATE_TASKS_FROM_AI':
      await handleCreateTasksFromAI(action, event);
      break;
    case 'SCHEDULE_DEAL_TASKS':
      await handleScheduleDealTasks(action, event);
      break;
    case 'CREATE_REFERRAL_TOUCH_SEQUENCE':
      await handleReferralTouchSequence(action, event);
      break;
    case 'INCREMENT_METRICS':
      await handleIncrementMetrics(action, event);
      break;
    default:
      console.warn(`[Automation] Unknown action type:`, action);
  }
}

/**
 * Create tasks based on templates (for listings, blasts, etc.)
 */
async function handleCreateTasks(
  action: Extract<AutomationActionConfig, { action: 'CREATE_TASKS' }>,
  event: AutomationEventPayload
): Promise<void> {
  if (event.type === 'LISTING_CREATED') {
    await createListingTasks(event.listingId, event.agentId, action.useAI);
  } else if (event.type === 'MARKETING_BLAST_SENT') {
    await createBlastFollowupTasks(event.blastId, event.agentId);
  }
}

/**
 * Create AI-suggested tasks
 */
async function handleCreateTasksFromAI(
  action: Extract<AutomationActionConfig, { action: 'CREATE_TASKS_FROM_AI' }>,
  event: AutomationEventPayload
): Promise<void> {
  // This is handled inline with CREATE_TASKS when useAI is true
  // Could be extended for more complex AI workflows
  console.log('[Automation] AI task creation delegated to CREATE_TASKS');
}

/**
 * Schedule tasks based on deal key dates
 */
async function handleScheduleDealTasks(
  action: Extract<AutomationActionConfig, { action: 'SCHEDULE_DEAL_TASKS' }>,
  event: AutomationEventPayload
): Promise<void> {
  if (event.type === 'DEAL_CREATED' || event.type === 'REPC_CREATED') {
    await createDealKeyDateTasks(event.dealId, event.agentId, action.useAI);
  }
}

/**
 * Create referral touch sequence when client stage changes
 */
async function handleReferralTouchSequence(
  action: Extract<
    AutomationActionConfig,
    { action: 'CREATE_REFERRAL_TOUCH_SEQUENCE' }
  >,
  event: AutomationEventPayload
): Promise<void> {
  if (event.type === 'CLIENT_STAGE_CHANGED') {
    await createReferralTouchSequence(
      event.clientId,
      event.agentId,
      event.toStage,
      action.sequenceType
    );
  }
}

/**
 * Increment metrics (placeholder for future analytics)
 */
async function handleIncrementMetrics(
  action: Extract<AutomationActionConfig, { action: 'INCREMENT_METRICS' }>,
  event: AutomationEventPayload
): Promise<void> {
  console.log(`[Automation] Incrementing metrics: ${action.kind}`);
  // Future: Update analytics/metrics tables
}

/**
 * Create default tasks for a new listing
 */
async function createListingTasks(
  listingId: string,
  agentId: string,
  useAI?: boolean
): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    console.error(`[Automation] Listing ${listingId} not found`);
    return;
  }

  const baseTasks = [
    {
      title: 'Review listing photos and property remarks',
      description: 'Ensure all photos are high-quality and description is compelling',
      category: 'MARKETING' as const,
      dueInDays: 0,
    },
    {
      title: `Prepare "Just Listed" email blast for ${listing.addressLine1}`,
      description: 'Send announcement to sphere and potential buyers',
      category: 'MARKETING' as const,
      dueInDays: 1,
    },
    {
      title: `Plan first open house for ${listing.addressLine1}`,
      description: 'Schedule and prepare for open house event',
      category: 'MARKETING' as const,
      dueInDays: 3,
    },
  ];

  // Create base tasks
  for (const task of baseTasks) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + task.dueInDays);

    await prisma.task.create({
      data: {
        agentId,
        listingId,
        title: task.title,
        description: task.description,
        category: task.category,
        status: 'OPEN',
        priority: task.dueInDays === 0 ? 'HIGH' : 'NORMAL',
        bucket: task.dueInDays === 0 ? 'TODAY' : 'THIS_WEEK',
        dueAt,
        createdFrom: 'AUTOMATION',
      },
    });
  }

  // Add AI-suggested tasks if enabled
  if (useAI) {
    try {
      const aiSuggestions = await suggestListingTasks({
        listingAddress: listing.addressLine1,
        price: listing.price,
        beds: listing.beds || undefined,
        baths: listing.baths || undefined,
      });

      for (const suggestion of aiSuggestions) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + (suggestion.dueInDays || 2));

        await prisma.task.create({
          data: {
            agentId,
            listingId,
            title: suggestion.title,
            description: suggestion.description,
            category: 'MARKETING',
            status: 'OPEN',
            priority: 'NORMAL',
            bucket: 'THIS_WEEK',
            dueAt,
            createdFrom: 'AI_SUGGESTED',
          },
        });
      }

      console.log(`[Automation] Created ${aiSuggestions.length} AI-suggested listing tasks`);
    } catch (error) {
      console.error('[Automation] Error creating AI tasks for listing:', error);
    }
  }

  console.log(`[Automation] Created ${baseTasks.length} base listing tasks`);
}

/**
 * Create tasks based on deal key dates (REPC deadlines)
 */
async function createDealKeyDateTasks(
  dealId: string,
  agentId: string,
  useAI?: boolean
): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      repc: true,
      property: true,
      buyer: true,
      seller: true,
    },
  });

  if (!deal) {
    console.error(`[Automation] Deal ${dealId} not found`);
    return;
  }

  // Welcome task
  const welcomeDueAt = new Date();
  welcomeDueAt.setDate(welcomeDueAt.getDate() + 1);

  await prisma.task.create({
    data: {
      agentId,
      dealId,
      clientId: deal.buyerId || deal.sellerId || undefined,
      title: `Welcome client and review ${deal.title} timeline`,
      description: 'Schedule call to review all key dates and next steps',
      category: 'CONTRACT',
      status: 'OPEN',
      priority: 'HIGH',
      bucket: 'TODAY',
      dueAt: welcomeDueAt,
      createdFrom: 'AUTOMATION',
    },
  });

  // Extract key dates from REPC if available
  if (deal.repc) {
    const keyDates: Record<string, Date> = {};

    if (deal.repc.dueDiligenceDeadline) {
      keyDates.dueDiligence = new Date(deal.repc.dueDiligenceDeadline);
    }
    // Financing deadline (accessing from rawJson since not in schema)
    const repcData = deal.repc.rawJson as any;
    if (repcData?.financingDeadline) {
      keyDates.financing = new Date(repcData.financingDeadline);
    }
    if (deal.repc.settlementDeadline) {
      keyDates.settlement = new Date(deal.repc.settlementDeadline);
    }

    // Create tasks before each deadline
    if (keyDates.dueDiligence) {
      const taskDue = new Date(keyDates.dueDiligence);
      taskDue.setDate(taskDue.getDate() - 3);

      await prisma.task.create({
        data: {
          agentId,
          dealId,
          clientId: deal.buyerId || deal.sellerId || undefined,
          title: 'Remind client about inspection deadline',
          description: 'Ensure inspection is scheduled and completed',
          category: 'CONTRACT',
          status: 'OPEN',
          priority: 'HIGH',
          bucket: 'THIS_WEEK',
          dueAt: taskDue,
          createdFrom: 'AUTOMATION',
        },
      });
    }

    if (keyDates.financing) {
      const taskDue = new Date(keyDates.financing);
      taskDue.setDate(taskDue.getDate() - 5);

      await prisma.task.create({
        data: {
          agentId,
          dealId,
          clientId: deal.buyerId || deal.sellerId || undefined,
          title: 'Confirm lender docs are complete',
          description: 'Check with lender on loan approval status',
          category: 'CONTRACT',
          status: 'OPEN',
          priority: 'HIGH',
          bucket: 'THIS_WEEK',
          dueAt: taskDue,
          createdFrom: 'AUTOMATION',
        },
      });
    }

    if (keyDates.settlement) {
      const taskDue = new Date(keyDates.settlement);
      taskDue.setDate(taskDue.getDate() - 3);

      await prisma.task.create({
        data: {
          agentId,
          dealId,
          clientId: deal.buyerId || deal.sellerId || undefined,
          title: 'Prepare closing packet for client',
          description: 'Gather all documents needed for settlement',
          category: 'CONTRACT',
          status: 'OPEN',
          priority: 'HIGH',
          bucket: 'THIS_WEEK',
          dueAt: taskDue,
          createdFrom: 'AUTOMATION',
        },
      });
    }

    // Use AI to suggest additional tasks if enabled
    if (useAI && Object.keys(keyDates).length > 0) {
      try {
        const keyDatesStr: Record<string, string> = {};
        Object.entries(keyDates).forEach(([key, date]) => {
          keyDatesStr[key] = date.toISOString().split('T')[0];
        });

        const aiSuggestions = await suggestDealTasksFromDates({
          keyDates: keyDatesStr,
          dealTitle: deal.title,
        });

        for (const suggestion of aiSuggestions) {
          let dueAt = new Date();
          
          if (suggestion.relatedDate && suggestion.daysBeforeDate && keyDates[suggestion.relatedDate]) {
            dueAt = new Date(keyDates[suggestion.relatedDate]);
            dueAt.setDate(dueAt.getDate() - suggestion.daysBeforeDate);
          } else if (suggestion.dueInDays) {
            dueAt.setDate(dueAt.getDate() + suggestion.dueInDays);
          } else {
            dueAt.setDate(dueAt.getDate() + 2);
          }

          await prisma.task.create({
            data: {
              agentId,
              dealId,
              clientId: deal.buyerId || deal.sellerId || undefined,
              title: suggestion.title,
              description: suggestion.description,
              category: 'CONTRACT',
              status: 'OPEN',
              priority: 'NORMAL',
              bucket: 'THIS_WEEK',
              dueAt,
              createdFrom: 'AI_SUGGESTED',
            },
          });
        }

        console.log(`[Automation] Created ${aiSuggestions.length} AI-suggested deal tasks`);
      } catch (error) {
        console.error('[Automation] Error creating AI tasks for deal:', error);
      }
    }
  }

  console.log(`[Automation] Created key date tasks for deal ${dealId}`);
}

/**
 * Create follow-up tasks when a marketing blast is sent
 */
async function createBlastFollowupTasks(
  blastId: string,
  agentId: string
): Promise<void> {
  const blast = await prisma.marketingBlast.findUnique({
    where: { id: blastId },
  });

  if (!blast) {
    console.error(`[Automation] Marketing blast ${blastId} not found`);
    return;
  }

  const tasks = [
    {
      title: `Review clicks & replies from "${blast.title}"`,
      description: 'Check engagement metrics and identify hot leads',
      dueInDays: 1,
      category: 'MARKETING' as const,
    },
    {
      title: `Call warm leads from "${blast.title}"`,
      description: 'Follow up with recipients who opened/clicked',
      dueInDays: 2,
      category: 'CALL' as const,
    },
  ];

  for (const task of tasks) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + task.dueInDays);

    await prisma.task.create({
      data: {
        agentId,
        marketingBlastId: blastId,
        title: task.title,
        description: task.description,
        category: task.category,
        status: 'OPEN',
        priority: task.dueInDays === 1 ? 'HIGH' : 'NORMAL',
        bucket: 'THIS_WEEK',
        dueAt,
        createdFrom: 'AUTOMATION',
      },
    });
  }

  console.log(`[Automation] Created ${tasks.length} follow-up tasks for blast ${blastId}`);
}

/**
 * Create referral touch sequence for past/referring clients
 */
async function createReferralTouchSequence(
  clientId: string,
  agentId: string,
  toStage: string,
  sequenceType: string
): Promise<void> {
  // Only create sequence for past clients or referring clients
  if (toStage !== 'PAST_CLIENT' && toStage !== 'REFERRING_CLIENT') {
    return;
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    console.error(`[Automation] Client ${clientId} not found`);
    return;
  }

  const clientName = `${client.firstName} ${client.lastName}`;
  
  const touchSequence = [
    {
      title: `Call ${clientName} to check in`,
      description: 'Personal call to maintain relationship and ask how things are going',
      category: 'CALL' as const,
      dueInDays: 7,
    },
    {
      title: `Send handwritten note to ${clientName}`,
      description: 'Mail a personal thank you note or seasonal card',
      category: 'NOTE' as const,
      dueInDays: 14,
    },
    {
      title: `Pop-by visit to ${clientName}`,
      description: 'Stop by with a small gift (cookies, plant, etc.)',
      category: 'POPBY' as const,
      dueInDays: 30,
    },
  ];

  for (const touch of touchSequence) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + touch.dueInDays);

    await prisma.task.create({
      data: {
        agentId,
        clientId,
        title: touch.title,
        description: touch.description,
        category: touch.category,
        status: 'OPEN',
        priority: 'NORMAL',
        bucket: touch.dueInDays <= 7 ? 'THIS_WEEK' : 'LATER',
        dueAt,
        createdFrom: 'AUTOMATION',
      },
    });
  }

  console.log(
    `[Automation] Created ${touchSequence.length} referral touch tasks for client ${clientId}`
  );
}
