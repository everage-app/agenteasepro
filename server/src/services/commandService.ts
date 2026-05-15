/**
 * Command Service
 * Handles natural language commands from agents.
 * TODO: Integrate OpenAI API for real NLP when OPENAI_API_KEY is set.
 */

interface CommandContext {
  dealId?: string;
  clientId?: string;
  listingId?: string;
}

interface CommandInput {
  agentId: string;
  text: string;
  context?: CommandContext;
}

interface CommandAction {
  type: string;
  parameters?: Record<string, any>;
  description: string;
}

interface CommandResponse {
  intent: string;
  confidence: number;
  actions: CommandAction[];
  messages: string[];
  requiresConfirmation: boolean;
}

/**
 * Main command handler.
 * Currently uses rule-based parsing. Will integrate OpenAI when available.
 */
export async function handleAgentCommand(input: CommandInput): Promise<CommandResponse> {
  const { text, context } = input;
  const lowerText = text.toLowerCase().trim();

  // TODO: When OPENAI_API_KEY is available, call OpenAI API here:
  /*
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an AI assistant for Utah real estate agents. Parse commands and return structured JSON with intent and actions."
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0.3,
  });
  */

  // Rule-based parsing for now
  
  // Pattern: "new deal" or "create deal" or "write an offer"
  if (
    lowerText.includes('new deal') ||
    lowerText.includes('create deal') ||
    lowerText.includes('write an offer') ||
    lowerText.includes('draft offer')
  ) {
    // Extract property address and price if mentioned
    const priceMatch = text.match(/\$?([\d,]+)k?/i);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) * 1000 : null;

    return {
      intent: 'CREATE_DEAL',
      confidence: 0.85,
      actions: [
        {
          type: 'NAVIGATE_TO_DEAL_WIZARD',
          description: 'Open the deal creation wizard',
        },
      ],
      messages: [
        `I'll help you create a new deal${price ? ` with a purchase price of $${price.toLocaleString()}` : ''}.`,
      ],
      requiresConfirmation: false,
    };
  }

  // Pattern: "due diligence" with days
  if (lowerText.includes('due diligence')) {
    const daysMatch = text.match(/(\d+)\s*days?/i);
    const days = daysMatch ? parseInt(daysMatch[1]) : 10;

    return {
      intent: 'SET_DUE_DILIGENCE',
      confidence: 0.8,
      actions: [
        {
          type: 'UPDATE_REPC_DEADLINE',
          parameters: { deadline: 'dueDiligence', days },
          description: `Set due diligence deadline to ${days} days from offer reference date`,
        },
      ],
      messages: [`Setting due diligence deadline to ${days} days.`],
      requiresConfirmation: context?.dealId ? false : true,
    };
  }

  // Pattern: "task:" or "todo:" or "remind me to"
  if (
    lowerText.startsWith('task:') ||
    lowerText.startsWith('todo:') ||
    lowerText.includes('remind me to') ||
    lowerText.includes('create task')
  ) {
    let taskTitle = text;
    if (lowerText.startsWith('task:')) taskTitle = text.substring(5).trim();
    if (lowerText.startsWith('todo:')) taskTitle = text.substring(5).trim();
    if (lowerText.includes('remind me to')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('remind me to') + 12).trim();
    }
    if (lowerText.includes('create task')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('create task') + 11).trim();
    }

    // Extract due date if mentioned
    const todayMatch = lowerText.includes('today');
    const tomorrowMatch = lowerText.includes('tomorrow');
    
    let dueAt = null;
    if (todayMatch) dueAt = new Date().toISOString();
    if (tomorrowMatch) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dueAt = tomorrow.toISOString();
    }

    return {
      intent: 'CREATE_TASK',
      confidence: 0.9,
      actions: [
        {
          type: 'CREATE_TASK',
          parameters: {
            title: taskTitle,
            dueAt,
            dealId: context?.dealId,
            clientId: context?.clientId,
          },
          description: `Create task: "${taskTitle}"`,
        },
      ],
      messages: [`I'll create a task: "${taskTitle}"${dueAt ? ' due ' + (todayMatch ? 'today' : 'tomorrow') : ''}.`],
      requiresConfirmation: true,
    };
  }

  // Pattern: "schedule" or "set deadline"
  if (lowerText.includes('schedule') || lowerText.includes('set deadline')) {
    return {
      intent: 'SET_DEADLINE',
      confidence: 0.7,
      actions: [],
      messages: [
        'I can help you set deadlines. Which deadline would you like to set? (e.g., "settlement", "due diligence", "financing")',
      ],
      requiresConfirmation: false,
    };
  }

  // Pattern: "summarize" or "what's happening"
  if (
    lowerText.includes('summarize') ||
    lowerText.includes('summary') ||
    lowerText.includes("what's happening") ||
    lowerText.includes('whats happening')
  ) {
    return {
      intent: 'SUMMARIZE',
      confidence: 0.85,
      actions: [
        {
          type: 'SHOW_AGENDA',
          description: 'Show upcoming deadlines and tasks',
        },
      ],
      messages: ['Let me show you your upcoming deadlines and tasks.'],
      requiresConfirmation: false,
    };
  }

  // Pattern: "marketing" or "promote" or "social media"
  if (
    lowerText.includes('marketing') ||
    lowerText.includes('promote') ||
    lowerText.includes('social media') ||
    lowerText.includes('list this')
  ) {
    return {
      intent: 'MARKETING',
      confidence: 0.75,
      actions: [
        {
          type: 'GENERATE_MARKETING_COPY',
          parameters: { listingId: context?.listingId },
          description: 'Generate AI marketing copy',
        },
      ],
      messages: ['I can help you create marketing content. Would you like me to generate social media posts?'],
      requiresConfirmation: true,
    };
  }

  // Default fallback
  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    actions: [],
    messages: [
      'I didn\'t quite understand that. Try commands like:',
      '• "Create a new deal for 123 Main St"',
      '• "Set due diligence to 10 days"',
      '• "Task: Call buyer about appraisal"',
      '• "Summarize my week"',
    ],
    requiresConfirmation: false,
  };
}
