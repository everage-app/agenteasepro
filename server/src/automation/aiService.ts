import { createAIChatCompletion, isAIConfigured } from '../lib/aiClient';

export interface ListingTaskSuggestion {
  title: string;
  description?: string;
  dueInDays?: number;
}

export interface DealTaskSuggestion {
  title: string;
  description?: string;
  relatedDate?: string;
  daysBeforeDate?: number;
  dueInDays?: number;
}

/**
 * Suggest tasks for a newly created listing using AI
 */
export async function suggestListingTasks(params: {
  listingAddress: string;
  price?: number;
  beds?: number;
  baths?: number;
}): Promise<ListingTaskSuggestion[]> {
  if (!isAIConfigured()) {
    console.warn('OpenAI API key not configured, returning default listing tasks');
    return getDefaultListingTasks();
  }

  try {
    const prompt = `You are a real estate assistant helping a Utah agent with a new listing.

Listing details:
- Address: ${params.listingAddress}
- Price: ${params.price ? `$${params.price.toLocaleString()}` : 'Not specified'}
- Beds: ${params.beds || 'Not specified'}
- Baths: ${params.baths || 'Not specified'}

Generate 3-5 specific, actionable tasks the agent should complete to market this listing effectively. For each task, provide:
- title: A clear, concise task title
- description: Brief explanation (optional)
- dueInDays: Number of days from now when it should be due

Return as JSON array: [{ "title": "...", "description": "...", "dueInDays": 1 }, ...]`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful real estate assistant. Return only valid JSON arrays with task suggestions.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
      cacheKey: 'automation-listing-tasks',
      cacheTtlMs: 2 * 60 * 1000,
    });

    if (!content) {
      return getDefaultListingTasks();
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0]) as ListingTaskSuggestion[];
      return tasks.slice(0, 5); // Max 5 tasks
    }

    return getDefaultListingTasks();
  } catch (error) {
    console.error('Error calling OpenAI for listing tasks:', error);
    return getDefaultListingTasks();
  }
}

/**
 * Suggest tasks for a new deal/REPC based on key dates
 */
export async function suggestDealTasksFromDates(params: {
  keyDates: Record<string, string>;
  dealTitle: string;
}): Promise<DealTaskSuggestion[]> {
  if (!isAIConfigured()) {
    console.warn('OpenAI API key not configured, returning default deal tasks');
    return getDefaultDealTasks(params.keyDates);
  }

  try {
    const datesStr = Object.entries(params.keyDates)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    const prompt = `You are a real estate assistant helping a Utah agent with a new deal: "${params.dealTitle}"

Key contract dates:
${datesStr}

Generate 4-6 specific tasks the agent should complete to ensure a smooth transaction. For each task, provide:
- title: Clear task title
- description: Brief explanation
- relatedDate: Which key date this relates to (if any)
- daysBeforeDate: How many days before that date to schedule the task

Return as JSON array: [{ "title": "...", "description": "...", "relatedDate": "...", "daysBeforeDate": 3 }, ...]`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful real estate assistant. Return only valid JSON arrays with task suggestions.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 600,
      cacheKey: 'automation-deal-tasks',
      cacheTtlMs: 2 * 60 * 1000,
    });

    if (!content) {
      return getDefaultDealTasks(params.keyDates);
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0]) as DealTaskSuggestion[];
      return tasks.slice(0, 6);
    }

    return getDefaultDealTasks(params.keyDates);
  } catch (error) {
    console.error('Error calling OpenAI for deal tasks:', error);
    return getDefaultDealTasks(params.keyDates);
  }
}

/**
 * Default listing tasks when AI is not available
 */
function getDefaultListingTasks(): ListingTaskSuggestion[] {
  return [
    {
      title: 'Review listing photos and property remarks',
      description: 'Ensure all photos are high-quality and description is compelling',
      dueInDays: 0,
    },
    {
      title: 'Prepare "Just Listed" email blast',
      description: 'Send announcement to sphere and potential buyers',
      dueInDays: 1,
    },
    {
      title: 'Create social media posts',
      description: 'Post on Facebook, Instagram with listing highlights',
      dueInDays: 1,
    },
    {
      title: 'Plan first open house',
      description: 'Schedule and prepare for open house event',
      dueInDays: 3,
    },
  ];
}

/**
 * Default deal tasks when AI is not available
 */
function getDefaultDealTasks(keyDates: Record<string, string>): DealTaskSuggestion[] {
  const tasks: DealTaskSuggestion[] = [
    {
      title: 'Welcome client and review contract timeline',
      description: 'Schedule call to review all key dates and next steps',
      dueInDays: 1,
    },
  ];

  if (keyDates.dueDiligenceDeadline) {
    tasks.push({
      title: 'Remind client about inspection deadline',
      description: 'Ensure inspection is scheduled and completed',
      relatedDate: 'dueDiligenceDeadline',
      daysBeforeDate: 3,
    });
  }

  if (keyDates.financingDeadline) {
    tasks.push({
      title: 'Confirm lender docs are complete',
      description: 'Check with lender on loan approval status',
      relatedDate: 'financingDeadline',
      daysBeforeDate: 5,
    });
  }

  if (keyDates.settlementDate) {
    tasks.push({
      title: 'Prepare closing packet for client',
      description: 'Gather all documents needed for settlement',
      relatedDate: 'settlementDate',
      daysBeforeDate: 3,
    });
  }

  return tasks;
}
