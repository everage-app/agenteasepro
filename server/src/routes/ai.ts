import { Router } from 'express';
import { TaskCreatedFrom } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  aiSuggestFormsForScenario,
  aiAssistFormFilling,
  aiExplainSection,
  aiDraftClause,
  aiDraftListingCopy,
} from '../services/aiService';
import {
  assistWithRepc,
  suggestTasksForEvent,
  draftListingCopy,
  draftMarketingCopy,
  summarizeDeal,
  summarizeDailyPlanFromActions,
  enhancedContractReview,
} from '../services/aiAssistantService';
import { handleAgentCommand } from '../services/enhancedCommandService';
import { getTodayPriorityActions } from '../services/priorityActionService';
import { getGoogleCalendarEventsForRange } from '../services/googleCalendarService';
import { getAgentAgenda } from '../services/calendarService';
import { prisma } from '../lib/prisma';
import { createAIChatCompletion, isAIConfigured } from '../lib/aiClient';
export const router = Router();

router.post('/forms/suggest-forms', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { scenario, dealId } = req.body as { scenario: string; dealId?: string };

  const result = await aiSuggestFormsForScenario({ agentId: req.agentId, scenario, dealId });
  res.json(result);
});

router.post('/forms/assist', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId, formCode, naturalLanguagePrompt, currentData } = req.body as {
    dealId: string;
    formCode: string;
    formInstanceId?: string;
    naturalLanguagePrompt: string;
    currentData: any;
  };

  const def = await prisma.formDefinition.findUnique({ where: { code: formCode } });
  if (!def) return res.status(404).json({ error: 'Form definition not found' });

  const deal = await prisma.deal.findFirst({ where: { id: dealId, agentId: req.agentId } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const result = await aiAssistFormFilling({
    agentId: req.agentId,
    dealId,
    formDefinition: def,
    currentData,
    naturalLanguagePrompt,
  });

  res.json(result);
});

router.post('/forms/explain-section', async (req: AuthenticatedRequest, res) => {
  const { formCode, sectionId, audience } = req.body as {
    formCode: string;
    sectionId: string;
    audience: 'agent' | 'client';
  };

  const result = await aiExplainSection({ formCode, sectionId, audience });
  res.json(result);
});

router.post('/forms/draft-clause', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId, instructions } = req.body as { dealId: string; instructions: string };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, agentId: req.agentId } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const result = await aiDraftClause({ dealId, instructions });
  res.json(result);
});

router.post('/marketing/draft-copy', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { listingId, style } = req.body as {
    listingId: string;
    style: 'short' | 'detailed' | 'social';
  };

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, agentId: req.agentId },
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const result = await aiDraftListingCopy({ listingId, style });
  res.json(result);
});

/**
 * POST /api/ai/command
 * Handle natural language commands from agents
 */
router.post('/command', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { text, context } = req.body as {
      text: string;
      context?: { dealId?: string; clientId?: string; listingId?: string };
    };

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const response = await handleAgentCommand({
      agentId: req.agentId,
      text,
      context,
    });

    // The enhanced command service handles task creation directly
    // Just return the response with any data
    res.json(response);
  } catch (error) {
    console.error('Error handling command:', error);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

/**
 * POST /api/ai/clients/summarize
 * Generate AI summary for a client
 */
router.post('/clients/summarize', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { clientId } = req.body as { clientId: string };

    const client = await prisma.client.findFirst({
      where: { id: clientId, agentId: req.agentId },
      include: {
        buyerDeals: {
          include: { property: true },
        },
        sellerDeals: {
          include: { property: true },
        },
        tasks: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Stub AI summary
    const summary = {
      overview: `${client.firstName} ${client.lastName} is currently in ${client.stage} stage with ${client.buyerDeals.length + client.sellerDeals.length} active deal(s).`,
      deals: client.buyerDeals.length + client.sellerDeals.length,
      openTasks: client.tasks.filter(t => t.status === 'OPEN').length,
      suggestedActions: [
        'Schedule a check-in call',
        'Send updated market analysis',
        'Review upcoming deadlines',
      ],
    };

    res.json(summary);
  } catch (error) {
    console.error('Error summarizing client:', error);
    res.status(500).json({ error: 'Failed to summarize client' });
  }
});

/**
 * POST /api/ai/repc/assist
 * Get AI assistance for REPC form completion
 */
router.post('/repc/assist', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { formValues, context } = req.body as {
      formValues: Record<string, any>;
      context?: string;
    };

    const result = await assistWithRepc(formValues, context);
    res.json(result);
  } catch (error) {
    console.error('REPC assist error:', error);
    res.status(500).json({ error: 'Failed to provide REPC assistance' });
  }
});

/**
 * POST /api/ai/contract/review
 * Enhanced AI contract review with comprehensive analysis
 */
router.post('/contract/review', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { formValues, options } = req.body as {
      formValues: Record<string, any>;
      options?: { includeAI?: boolean; dealContext?: Record<string, any> };
    };

    const result = await enhancedContractReview(formValues, options);
    res.json(result);
  } catch (error) {
    console.error('Contract review error:', error);
    res.status(500).json({ error: 'Failed to review contract' });
  }
});

/**
 * POST /api/ai/contract/create-tasks
 * Create tasks from contract review suggestions
 */
router.post('/contract/create-tasks', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { tasks, dealId } = req.body as {
      tasks: Array<{
        title: string;
        dueDate?: string;
        priority: 'high' | 'medium' | 'low';
        category: string;
      }>;
      dealId?: string;
    };

    const priorityMap = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
    const categoryMap: Record<string, string> = {
      deadline: 'CONTRACT',
      document: 'CONTRACT',
      followup: 'CLIENT_FOLLOWUP',
      compliance: 'CONTRACT',
    };

    const createdTasks = await Promise.all(
      tasks.map(async (task) => {
        return prisma.task.create({
          data: {
            agentId: req.agentId!,
            title: task.title,
            dueAt: task.dueDate ? new Date(task.dueDate) : undefined,
            priority: priorityMap[task.priority] as any,
            category: categoryMap[task.category] as any || 'CONTRACT',
            status: 'OPEN',
            createdFrom: TaskCreatedFrom.AI_SUGGESTED,
            dealId: dealId || undefined,
          },
        });
      })
    );

    res.json({ created: createdTasks.length, tasks: createdTasks });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

/**
 * POST /api/ai/tasks/suggest
 * Get AI task suggestions based on context
 */
router.post('/tasks/suggest', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { eventType, payload } = req.body as {
      eventType: string;
      payload: Record<string, any>;
    };
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const agenda = await getAgentAgenda(req.agentId, now, weekOut);
    const openDeals = await prisma.deal.findMany({
      where: {
        agentId: req.agentId,
        status: { in: ['ACTIVE', 'OFFER_SENT', 'UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING'] },
      },
      include: { property: true },
      take: 5,
    });
    const priorityClients = await prisma.client.findMany({
      where: {
        agentId: req.agentId,
        stage: { in: ['ACTIVE', 'UNDER_CONTRACT'] },
      },
      orderBy: [{ lastContactAt: 'asc' }, { createdAt: 'asc' }],
      take: 5,
    });
    const priorityLeads = await prisma.lead.findMany({
      where: {
        agentId: req.agentId,
        converted: false,
      },
      orderBy: [{ lastContact: 'asc' }, { createdAt: 'asc' }],
      take: 5,
    });

    const contextPayload = {
      agenda,
      openDeals: openDeals.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        address: d.property ? `${d.property.street}, ${d.property.city}` : undefined,
      })),
      priorityClients: priorityClients.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        stage: c.stage,
        lastContactAt: c.lastContactAt,
      })),
      priorityLeads: priorityLeads.map((l) => ({
        id: l.id,
        name: `${l.firstName} ${l.lastName}`,
        priority: l.priority,
        lastContact: l.lastContact,
      })),
      ...payload,
    };

    const baseSuggestions = [] as Array<{
      title: string;
      description: string;
      category: 'contract' | 'marketing' | 'client_followup';
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      dueInDays?: number;
      dealId?: string;
      clientId?: string;
    }>;

    const firstAgendaEvent = agenda
      .flatMap((day) => day.events.map((evt) => ({ day: day.date, evt })))
      .slice(0, 2);
    for (const entry of firstAgendaEvent) {
      baseSuggestions.push({
        title: `Prep for ${entry.evt.title}`,
        description: `${entry.evt.dealTitle} • ${entry.day}`,
        category: 'contract',
        priority: 'HIGH',
        dueInDays: 0,
        dealId: entry.evt.dealId,
      });
    }

    for (const client of priorityClients.slice(0, 2)) {
      const clientName = `${client.firstName} ${client.lastName}`.trim();
      baseSuggestions.push({
        title: `Follow up ${clientName}`,
        description: `Check-in and update next steps for ${client.stage.toLowerCase().replace('_', ' ')} client.`,
        category: 'client_followup',
        priority: 'MEDIUM',
        dueInDays: 0,
        clientId: client.id,
      });
    }

    for (const lead of priorityLeads.slice(0, 2)) {
      const leadName = `${lead.firstName} ${lead.lastName}`.trim();
      baseSuggestions.push({
        title: `Follow up lead ${leadName}`,
        description: `Reconnect and log next steps for this ${lead.priority.toLowerCase()} lead.`,
        category: 'client_followup',
        priority: 'MEDIUM',
        dueInDays: 0,
      });
    }

    const aiSuggestions = await suggestTasksForEvent(eventType, contextPayload);
    const normalizedAi = (aiSuggestions || []).map((task) => ({
      ...task,
      priority: task.priority.toUpperCase(),
    }));

    const merged = [...baseSuggestions, ...normalizedAi].slice(0, 6);
    res.json({ suggestions: merged });
  } catch (error) {
    console.error('Task suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate task suggestions' });
  }
});

/**
 * POST /api/ai/listings/generate-description
 * Generate listing descriptions using AI
 */
router.post('/listings/generate-description', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { listingId } = req.body as { listingId: string };

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, agentId: req.agentId },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const descriptions = await draftListingCopy({
      address: listing.headline || undefined,
      price: listing.price ? Number(listing.price) : undefined,
      notes: listing.description || undefined,
    });

    res.json(descriptions);
  } catch (error) {
    console.error('Listing description error:', error);
    res.status(500).json({ error: 'Failed to generate listing description' });
  }
});

/**
 * POST /api/ai/marketing/generate-copy
 * Generate marketing copy for blasts
 */
router.post('/marketing/generate-copy', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { type, property, details } = req.body as {
      type: 'new_listing' | 'open_house' | 'price_drop' | 'just_sold';
      property?: {
        address?: string;
        price?: number;
        beds?: number;
        baths?: number;
      };
      details?: string;
    };

    const copy = await draftMarketingCopy({ type, property, details });
    res.json(copy);
  } catch (error) {
    console.error('Marketing copy error:', error);
    res.status(500).json({ error: 'Failed to generate marketing copy' });
  }
});

/**
 * POST /api/ai/deals/summarize
 * Get AI summary of a deal
 */
router.post('/deals/summarize', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { dealId } = req.body as { dealId: string };

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, agentId: req.agentId },
      include: {
        buyer: true,
        seller: true,
        property: true,
        tasks: true,
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const summary = await summarizeDeal(deal);
    res.json(summary);
  } catch (error) {
    console.error('Deal summary error:', error);
    res.status(500).json({ error: 'Failed to summarize deal' });
  }
});

/**
 * POST /api/ai/calendar/daily-plan
 * Build a daily action plan using AI
 */
router.post('/calendar/daily-plan', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { date } = req.body as { date: string };
    const parsed = date ? new Date(date) : new Date();
    const targetDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

    // Use the existing Priority Action Center aggregator so daily plan stays useful
    // even when AI is not configured, and so actions are grounded in real records.
    const priorityActions = await getTodayPriorityActions(req.agentId, targetDate);

    type DailyPlanAction = {
      id: string;
      title: string;
      description: string;
      urgency: 'urgent' | 'today' | 'soon';
      relatedTo?: { type: 'deal' | 'task' | 'client' | 'listing' | 'calendar'; id: string };
    };

    let actions: DailyPlanAction[] = priorityActions
      .map((a) => {
        const urgency: 'urgent' | 'today' | 'soon' =
          a.priority === 'HIGH'
            ? 'urgent'
            : a.dueDate
              ? (a.dueDate.toDateString() === targetDate.toDateString() ? 'today' : 'soon')
              : 'today';

        const relatedTo: DailyPlanAction['relatedTo'] =
          a.relatedId && (a.relatedType === 'deal' || a.relatedType === 'task' || a.relatedType === 'client' || a.relatedType === 'listing')
            ? { type: a.relatedType, id: a.relatedId }
            : undefined;

        return {
          id: a.id,
          title: a.title,
          description: a.description || a.dealOrListing || '',
          urgency,
          relatedTo,
        };
      })
      .slice(0, 8);

    // If Google Calendar is connected, include today's appointments as additional context/actions.
    // These won't navigate anywhere yet; they exist to make the daily plan reflect real appointments.
    try {
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const googleEvents = await getGoogleCalendarEventsForRange(req.agentId, dayStart, dayEnd);
      const googleActions: DailyPlanAction[] = googleEvents
        .slice(0, 5)
        .map((evt) => {
          const isAllDay = Boolean(evt.allDay);
          const timeLabel = isAllDay
            ? 'All day'
            : evt.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          const descParts = [timeLabel];
          if (evt.location) descParts.push(evt.location);
          return {
            id: `gcal-${evt.id}`,
            title: evt.title,
            description: descParts.join(' • '),
            urgency: 'today' as const,
            relatedTo: { type: 'calendar' as const, id: dayStart.toISOString().split('T')[0] },
          };
        });

      // Append appointments without displacing urgent internal actions.
      // Keep the list capped.
      actions = [...actions, ...googleActions].slice(0, 8);
    } catch {
      // ignore
    }

    if (actions.length === 0) {
      actions = [
        {
          id: 'default-1',
          title: "Review today's calendar & deadlines",
          description: 'Scan key dates, appointments, and contract deadlines for anything time-sensitive.',
          urgency: 'today' as const,
          relatedTo: { type: 'calendar' as const, id: targetDate.toISOString().split('T')[0] },
        },
        {
          id: 'default-2',
          title: 'Triage open tasks and pick your top 3',
          description: 'Identify the 1-2 most urgent tasks and block time to finish them early.',
          urgency: 'today' as const,
          relatedTo: { type: 'task' as const, id: 'tasks' },
        },
        {
          id: 'default-3',
          title: 'Send 2 quick client follow-ups',
          description: 'Confirm next steps with active clients and keep deals moving forward.',
          urgency: 'soon' as const,
          relatedTo: undefined,
        },
      ];
    }

    const summary = await summarizeDailyPlanFromActions({
      date: targetDate.toISOString(),
      actions: actions.map(a => ({ title: a.title, description: a.description, urgency: a.urgency })),
    });

    res.json({ summary, actions });
  } catch (error) {
    console.error('Daily plan error:', error);
    res.status(500).json({ error: 'Failed to build daily plan' });
  }
});

/**
 * POST /api/ai/contracts/assist
 * AI-powered contracts assistant with conversational interface
 */
router.post('/contracts/assist', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { message, context } = req.body as {
      message: string;
      context?: {
        dealId?: string;
        formCode?: string;
        currentStep?: string;
        formData?: Record<string, any>;
        dealStatus?: string;
      };
    };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get deal context if provided
    let dealContext = '';
    let dealSnapshot: any | null = null;
    if (context?.dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: context.dealId, agentId: req.agentId },
        include: {
          buyer: true,
          seller: true,
          property: true,
          repc: true,
          tasks: {
            where: { status: 'OPEN' },
            take: 5,
          },
        },
      });

      if (deal) {
        dealSnapshot = deal;
        dealContext = `
Current Deal Information:
- Property: ${deal.property?.street || 'Not specified'}, ${deal.property?.city || ''}, ${deal.property?.state || 'UT'}
- Status: ${deal.status}
- Buyer: ${deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : 'Not specified'}
- Seller: ${deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}` : 'Not specified'}
${deal.repc ? `
REPC Details:
- Purchase Price: $${Number(deal.repc.purchasePrice).toLocaleString()}
- Earnest Money: $${deal.repc.earnestMoneyAmount || 'Not specified'}
- Settlement Deadline: ${deal.repc.settlementDeadline ? new Date(deal.repc.settlementDeadline).toLocaleDateString() : 'Not set'}
- Due Diligence Deadline: ${deal.repc.dueDiligenceDeadline ? new Date(deal.repc.dueDiligenceDeadline).toLocaleDateString() : 'Not set'}
- Financing/Appraisal Deadline: ${deal.repc.financingAppraisalDeadline ? new Date(deal.repc.financingAppraisalDeadline).toLocaleDateString() : 'Not set'}
` : ''}
${deal.tasks.length > 0 ? `
Open Tasks:
${deal.tasks.map(t => `- ${t.title}`).join('\n')}
` : ''}`;
      }
    }

    // Check for OpenAI API Key
    if (!isAIConfigured()) {
      console.warn('OPENAI_API_KEY not found, returning local guidance');

      const actions: Array<{ type: string; label: string; data?: any }> = [];
      const lowerMsg = message.toLowerCase();

      const propertyLabel = dealSnapshot?.property?.street || dealSnapshot?.title || 'your deal';
      const status = dealSnapshot?.status || context?.dealStatus || 'ACTIVE';

      let response = `I can help with REPC forms, deadlines, addenda, and e-signatures. `;
      if (dealSnapshot) {
        response += `You're working on ${propertyLabel} (${status.replace(/_/g, ' ')}). `;
      }

      if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        response = `Hey! I can help you complete REPCs, auto-fill key fields, and send for e-sign. What do you want to do first?`;
      } else if (lowerMsg.includes('deadline') || lowerMsg.includes('due diligence') || lowerMsg.includes('closing')) {
        response = `Key REPC deadlines usually include due diligence, financing/appraisal, and settlement. I can help you confirm dates and create reminders.`;
        actions.push({ type: 'navigate', label: 'View Calendar', data: { route: '/calendar' } });
        if (context?.dealId) {
          actions.push({ type: 'navigate', label: 'Open REPC', data: { route: `/deals/${context.dealId}/repc` } });
        }
      } else if (lowerMsg.includes('send') && (lowerMsg.includes('sign') || lowerMsg.includes('esign'))) {
        response = `To send for e-sign, open the REPC, verify fields, then use the Send for Signature action. I can take you there now.`;
        actions.push({
          type: 'navigate',
          label: 'Send for E-Sign',
          data: { route: context?.dealId ? `/deals/${context.dealId}/repc` : '/contracts' },
        });
      } else if (lowerMsg.includes('pdf') || lowerMsg.includes('editor')) {
        response = `The PDF editor lets you merge, reorder, and export documents. Want to open it?`;
        actions.push({ type: 'navigate', label: 'Open PDF Editor', data: { route: '/contracts/pdf-editor' } });
      } else if (lowerMsg.includes('template') || lowerMsg.includes('form')) {
        response = `I can help you browse Utah templates and start a REPC from a deal. Want the templates list?`;
        actions.push({ type: 'navigate', label: 'View Templates', data: { route: '/contracts' } });
      } else if (lowerMsg.includes('repc') || lowerMsg.includes('start') || lowerMsg.includes('new')) {
        response = `Let’s start the REPC. I can open the wizard and help auto-fill key fields from the deal.`;
        actions.push({
          type: 'navigate',
          label: 'Start REPC',
          data: { route: context?.dealId ? `/deals/${context.dealId}/repc` : '/deals/new' },
        });
      } else if (lowerMsg.includes('autofill') || lowerMsg.includes('smart') || lowerMsg.includes('import')) {
        response = `Use Smart Fill to import buyer/seller, address, and MLS details, then review for accuracy. I can open the REPC for you.`;
        actions.push({
          type: 'navigate',
          label: 'Open Smart Fill',
          data: { route: context?.dealId ? `/deals/${context.dealId}/repc` : '/contracts' },
        });
      } else {
        const nextSteps: string[] = [];
        if (status === 'UNDER_CONTRACT' || status === 'DUE_DILIGENCE') {
          nextSteps.push('Review deadlines', 'Confirm documents are complete', 'Prep for e-sign');
        } else {
          nextSteps.push('Start the REPC', 'Set key dates', 'Send for signatures');
        }
        response += `Next steps I can help with: ${nextSteps.join(', ')}.`;
      }

      return res.json({
        message: response,
        actions: actions.slice(0, 3),
      });
    }

    // Call OpenAI for conversational assistance

    const systemPrompt = `You are AgentEasePro's AI Contracts Assistant, a helpful guide for Utah real estate agents.

Your role is to:
1. Help agents understand and complete REPC (Real Estate Purchase Contract) forms
2. Explain contract terms in plain language
3. Guide through the transaction process step by step
4. Help track important deadlines
5. Suggest addendums when appropriate
6. Provide checklists for different stages (due diligence, financing, closing)

Important guidelines:
- Focus ONLY on Utah real estate contracts and practices
- Be specific about Utah-specific requirements and timelines
- Never provide legal advice - remind agents to consult their broker or attorney for legal questions
- Be concise but thorough
- When explaining terms, use simple language
- Proactively mention important deadlines and common pitfalls
- If asked about something outside real estate contracts, politely redirect

${dealContext ? `\n${dealContext}` : ''}
${context?.currentStep ? `\nAgent is currently working on: ${context.currentStep}` : ''}
${context?.formData ? `\nCurrent form data: ${JSON.stringify(context.formData)}` : ''}`;

    const response = await createAIChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      maxTokens: 800,
    });

    // Parse for potential actions
    const actions: Array<{ type: string; label: string; data?: any }> = [];

    // Detect if response mentions specific forms or actions
    if (response.toLowerCase().includes('repc') && !context?.dealId) {
      actions.push({
        type: 'navigate',
        label: 'Start New REPC',
        data: { route: '/deals/new' },
      });
    }

    if (response.toLowerCase().includes('addendum')) {
      actions.push({
        type: 'navigate',
        label: 'View Addendums',
        data: { route: context?.dealId ? `/deals/${context.dealId}/addendums` : '/contracts' },
      });
    }

    if (response.toLowerCase().includes('deadline') || response.toLowerCase().includes('calendar')) {
      actions.push({
        type: 'navigate',
        label: 'View Calendar',
        data: { route: '/calendar' },
      });
    }

    if (response.toLowerCase().includes('task') || response.toLowerCase().includes('checklist')) {
      actions.push({
        type: 'create_task',
        label: 'Create Task',
        data: { dealId: context?.dealId },
      });
    }

    res.json({
      message: response,
      actions: actions.slice(0, 3), // Limit to 3 actions
    });
  } catch (error) {
    console.error('Contracts AI assist error:', error);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

/**
 * POST /api/ai/contracts/explain
 * Explain a specific contract term or section
 */
router.post('/contracts/explain', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { term, audience = 'agent' } = req.body as {
      term: string;
      audience?: 'agent' | 'client';
    };

    if (!term || !term.trim()) {
      return res.status(400).json({ error: 'Term is required' });
    }

    if (!isAIConfigured()) {
      return res.json({
        term,
        explanation: `(Demo Mode) This is a simulated explanation for "${term}". In a production environment, I would provide a detailed legal and practical breakdown of this term specific to Utah real estate law, tailored for a ${audience} audience.`,
        audience,
      });
    }

    const prompt = audience === 'client'
      ? `Explain the following Utah real estate contract term in simple, client-friendly language. Avoid jargon and be reassuring: "${term}"`
      : `Explain the following Utah real estate contract term for a real estate agent. Be specific about Utah requirements and best practices: "${term}"`;

    const explanation = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are an expert on Utah real estate contracts. Provide clear, accurate explanations. Never give legal advice.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 400,
    });

    res.json({
      term,
      explanation,
      audience,
    });
  } catch (error) {
    console.error('Contract explain error:', error);
    res.status(500).json({ error: 'Failed to explain term' });
  }
});

/**
 * POST /api/ai/contracts/checklist
 * Generate a checklist for a specific contract stage
 */
router.post('/contracts/checklist', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { stage, dealId } = req.body as {
      stage: 'offer' | 'due_diligence' | 'financing' | 'closing';
      dealId?: string;
    };

    // Predefined checklists for common stages
    const checklists: Record<string, Array<{ task: string; priority: string; notes?: string }>> = {
      offer: [
        { task: 'Verify buyer pre-approval status', priority: 'high' },
        { task: 'Complete comparative market analysis', priority: 'high' },
        { task: 'Discuss offer strategy with buyer', priority: 'high' },
        { task: 'Determine earnest money amount', priority: 'medium' },
        { task: 'Set appropriate contingency deadlines', priority: 'high' },
        { task: 'Prepare REPC form', priority: 'high' },
        { task: 'Include all required addendums', priority: 'medium' },
        { task: 'Review with buyer before submission', priority: 'high' },
      ],
      due_diligence: [
        { task: 'Order home inspection', priority: 'high', notes: 'Schedule ASAP after acceptance' },
        { task: 'Order pest inspection if needed', priority: 'medium' },
        { task: 'Review HOA documents (if applicable)', priority: 'high' },
        { task: 'Verify property boundaries/survey', priority: 'medium' },
        { task: 'Check for permits on recent work', priority: 'medium' },
        { task: 'Review title commitment', priority: 'high' },
        { task: 'Negotiate repairs if needed', priority: 'high' },
        { task: 'Track due diligence deadline', priority: 'high', notes: 'Critical deadline!' },
      ],
      financing: [
        { task: 'Submit loan application', priority: 'high' },
        { task: 'Provide all lender documentation', priority: 'high' },
        { task: 'Order appraisal', priority: 'high' },
        { task: 'Track appraisal completion', priority: 'high' },
        { task: 'Review loan estimate', priority: 'medium' },
        { task: 'Clear any loan conditions', priority: 'high' },
        { task: 'Obtain final loan approval', priority: 'high' },
        { task: 'Track financing deadline', priority: 'high', notes: 'Critical deadline!' },
      ],
      closing: [
        { task: 'Schedule final walkthrough', priority: 'high' },
        { task: 'Review closing disclosure', priority: 'high' },
        { task: 'Verify wire transfer instructions', priority: 'high', notes: 'Call to verify - fraud prevention!' },
        { task: 'Prepare closing funds', priority: 'high' },
        { task: 'Coordinate key exchange', priority: 'medium' },
        { task: 'Transfer utilities', priority: 'medium' },
        { task: 'Complete closing documents', priority: 'high' },
        { task: 'Record deed', priority: 'high' },
      ],
    };

    const checklist = checklists[stage] || checklists.offer;

    res.json({
      stage,
      items: checklist,
      totalItems: checklist.length,
      highPriority: checklist.filter(c => c.priority === 'high').length,
    });
  } catch (error) {
    console.error('Checklist generation error:', error);
    res.status(500).json({ error: 'Failed to generate checklist' });
  }
});

export default router;
