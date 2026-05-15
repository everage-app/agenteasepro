/**
 * Enhanced Command Service
 * Handles natural language commands from agents with full integration
 * of all AgentEasePro features: property search, tasks, deals, clients, marketing, etc.
 */

import { TaskCreatedFrom } from '@prisma/client';
import { searchProperties, SearchCriteria } from './propertySearchService';
import { prisma } from '../lib/prisma';
import { findCityFromText, CITY_ALIASES } from '../lib/utahData';

interface CommandContext {
  dealId?: string;
  clientId?: string;
  listingId?: string;
  leadId?: string;
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
  data?: any; // For returning search results, etc.
}

interface CommandResponse {
  intent: string;
  confidence: number;
  actions: CommandAction[];
  messages: string[];
  requiresConfirmation: boolean;
  data?: any; // Additional data like search results
}

// Helper to detect if text looks like an address
function looksLikeAddress(text: string): boolean {
  // Common street suffixes
  const streetSuffixes = /\b(st|street|ave|avenue|dr|drive|ln|lane|rd|road|way|blvd|boulevard|ct|court|cir|circle|pl|place|pkwy|parkway|ter|terrace|hwy|highway)\b/i;
  // Address pattern: number followed by words
  const addressPattern = /^\d+\s+\w+/i;
  return streetSuffixes.test(text) && addressPattern.test(text.trim());
}

// Helper to extract address from text
function extractAddress(text: string): string | null {
  // Match patterns like "11064 S Paddle Board Way" or "123 Main Street"
  const addressPattern = /\b(\d+\s+(?:[nsew]\.?\s+)?[a-zA-Z]+(?:\s+[a-zA-Z]+)*\s*(?:st|street|ave|avenue|dr|drive|ln|lane|rd|road|way|blvd|boulevard|ct|court|cir|circle|pl|place|pkwy|parkway|ter|terrace|hwy|highway))\b/i;
  const match = text.match(addressPattern);
  return match ? match[1].trim() : null;
}

// Helper to extract price from text
function extractPrice(text: string): number | null {
  // First check if this looks like an address - don't extract house numbers as prices
  if (looksLikeAddress(text)) {
    // Only look for explicit price patterns with $ or "under/over/around"
    const explicitPriceMatch = text.match(/(?:under|over|around|about|max|min|priced?\s*(?:at|around)?)\s*\$?([\d,]+)\s*k?/i) 
      || text.match(/\$([\d,]+)\s*k?/i);
    if (explicitPriceMatch) {
      let value = parseInt(explicitPriceMatch[1].replace(/,/g, ''));
      if (text.toLowerCase().includes('k') && value < 10000) {
        value *= 1000;
      }
      return value > 1000 ? value : null;
    }
    return null;
  }
  
  // Match patterns like "$500k", "$500,000", "500k", "500000" but not standalone numbers that could be addresses
  const priceMatch = text.match(/\$\s*([\d,]+)\s*k?/i) 
    || text.match(/(?:under|over|around|about|max|min|priced?\s*(?:at|around)?)\s*\$?([\d,]+)\s*k?/i)
    || text.match(/([\d,]+)\s*k(?:\s|$)/i); // Must have 'k' suffix if no $
  
  if (priceMatch) {
    const numStr = priceMatch[1] || priceMatch[2];
    let value = parseInt(numStr.replace(/,/g, ''));
    // If ends with 'k' and is a small number, multiply
    if (/k\b/i.test(text) && value < 10000) {
      value *= 1000;
    }
    // Only return if it's a reasonable price (> $50k for real estate)
    return value >= 50000 ? value : null;
  }
  return null;
}

// Helper to extract beds/baths
function extractBedsBaths(text: string): { beds?: number; baths?: number } {
  const result: { beds?: number; baths?: number } = {};
  const bedsMatch = text.match(/(\d+)\s*(?:bed|br|bedroom)/i);
  const bathsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i);
  if (bedsMatch) result.beds = parseInt(bedsMatch[1]);
  if (bathsMatch) result.baths = parseFloat(bathsMatch[1]);
  return result;
}

// Helper to extract city/zip using comprehensive Utah data
function extractLocation(text: string): { city?: string; zipCode?: string; county?: string } {
  const result: { city?: string; zipCode?: string; county?: string } = {};
  
  // Extract zip code
  const zipMatch = text.match(/\b(\d{5})\b/);
  if (zipMatch) result.zipCode = zipMatch[1];
  
  // Check aliases first (slc -> Salt Lake City, etc.)
  const lowerText = text.toLowerCase();
  for (const [alias, fullName] of Object.entries(CITY_ALIASES)) {
    if (lowerText.includes(alias)) {
      result.city = fullName;
      break;
    }
  }
  
  // Use comprehensive Utah city finder if no alias match
  if (!result.city) {
    const cityMatch = findCityFromText(text);
    if (cityMatch) {
      result.city = cityMatch.city;
      result.county = cityMatch.county;
    }
  }
  
  return result;
}

// Helper to extract date references
function extractDate(text: string): Date | null {
  const lowerText = text.toLowerCase();
  const now = new Date();
  
  if (lowerText.includes('today')) {
    return now;
  }
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (lowerText.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
  
  // Match "in X days"
  const daysMatch = text.match(/in\s+(\d+)\s*days?/i);
  if (daysMatch) {
    const future = new Date(now);
    future.setDate(future.getDate() + parseInt(daysMatch[1]));
    return future;
  }
  
  // Match day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i])) {
      const target = new Date(now);
      const currentDay = now.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      target.setDate(target.getDate() + daysUntil);
      return target;
    }
  }
  
  return null;
}

/**
 * Main command handler with full feature integration
 */
export async function handleAgentCommand(input: CommandInput): Promise<CommandResponse> {
  const { agentId, text, context } = input;
  const lowerText = text.toLowerCase().trim();

  // ============================================================
  // PROPERTY SEARCH - "search", "find", "look for", "homes in", etc.
  // ============================================================
  
  // Check for MLS number first (7 digits is standard for Utah)
  const mlsMatch = text.match(/mls\s*#?\s*(\d{7})/i) || 
                   text.match(/^#?(\d{7})$/) ||
                   text.match(/\b(\d{7})\b/);
  
  if (
    mlsMatch ||
    lowerText.includes('search') ||
    lowerText.includes('find home') ||
    lowerText.includes('find house') ||
    lowerText.includes('find propert') ||
    lowerText.includes('look for') ||
    lowerText.includes('look up') ||
    lowerText.includes('homes in') ||
    lowerText.includes('houses in') ||
    lowerText.includes('listings in') ||
    looksLikeAddress(text) ||
    (lowerText.match(/\d{5}/) && !lowerText.includes('task')) // zip code but not in task context
  ) {
    const location = extractLocation(text);
    const address = extractAddress(text);
    const price = extractPrice(text);
    const { beds, baths } = extractBedsBaths(text);
    
    // Build search query - MLS number takes priority, then address
    let searchQuery = '';
    if (mlsMatch) {
      searchQuery = mlsMatch[1];
    } else if (address) {
      searchQuery = address;
    }
    
    const criteria: SearchCriteria = {
      query: searchQuery || undefined,
      city: location.city,
      zipCode: location.zipCode,
      maxPrice: price || undefined,
      minBeds: beds,
      minBaths: baths,
      sources: ['utahrealestate', 'zillow'],
    };

    // Only search if we have something to search for
    if (criteria.query || criteria.city || criteria.zipCode) {
      try {
        const results = await searchProperties(agentId, criteria);
        
        // Build description
        let locationDesc = '';
        if (mlsMatch) {
          locationDesc = `MLS# ${mlsMatch[1]}`;
        } else if (address) {
          locationDesc = address;
        } else if (criteria.city) {
          locationDesc = criteria.city;
        } else if (criteria.zipCode) {
          locationDesc = criteria.zipCode;
        }
        
        const filterDesc = [
          price ? `under $${(price/1000).toFixed(0)}k` : '',
          beds ? `${beds}+ beds` : '',
          baths ? `${baths}+ baths` : '',
        ].filter(Boolean).join(', ');

        return {
          intent: 'PROPERTY_SEARCH',
          confidence: 0.95,
          actions: [
            {
              type: 'SHOW_SEARCH_RESULTS',
              parameters: criteria,
              description: `Found ${results.length} properties`,
              data: results.slice(0, 10), // Return top 10
            },
          ],
          messages: [
            `Found ${results.length} properties${locationDesc ? ` matching "${locationDesc}"` : ''}${filterDesc ? ` (${filterDesc})` : ''}.`,
            results.length > 0 
              ? `Top result: ${results[0].address.fullAddress} - $${results[0].price.toLocaleString()}`
              : 'Try adjusting your search criteria.',
          ],
          requiresConfirmation: false,
          data: { properties: results.slice(0, 10), criteria },
        };
      } catch (error) {
        console.error('Property search error:', error);
      }
    }
    
    return {
      intent: 'PROPERTY_SEARCH',
      confidence: 0.7,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/search' },
          description: 'Open property search',
        },
      ],
      messages: [
        'I can search for properties. Try:',
        '• "Find homes in Park City under 800k"',
        '• "Search 3 bed houses in 84103"',
        '• "11064 S Paddle Board Way South Jordan"',
        '• "MLS# 1234567"',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // DEAL CREATION - "new deal", "write offer", "create deal"
  // ============================================================
  if (
    lowerText.includes('new deal') ||
    lowerText.includes('create deal') ||
    lowerText.includes('write an offer') ||
    lowerText.includes('write offer') ||
    lowerText.includes('draft offer') ||
    lowerText.includes('start a deal') ||
    lowerText.includes('make an offer')
  ) {
    const price = extractPrice(text);
    const addressMatch = text.match(/(?:for|at|on)\s+(\d+[^,\n]+(?:st|street|ave|avenue|dr|drive|ln|lane|rd|road|way|blvd|ct|court|cir|circle)[^,\n]*)/i);

    return {
      intent: 'CREATE_DEAL',
      confidence: 0.9,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { 
            route: '/deals/new',
            prefill: {
              price,
              address: addressMatch ? addressMatch[1].trim() : undefined,
            }
          },
          description: 'Open deal creation wizard',
        },
      ],
      messages: [
        `I'll help you create a new deal${price ? ` at $${price.toLocaleString()}` : ''}${addressMatch ? ` for ${addressMatch[1].trim()}` : ''}.`,
        'Opening the deal wizard...',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // TASK CREATION - "task:", "remind me", "todo:", "schedule"
  // ============================================================
  if (
    lowerText.startsWith('task:') ||
    lowerText.startsWith('todo:') ||
    lowerText.includes('remind me') ||
    lowerText.includes('create task') ||
    lowerText.includes('add task') ||
    lowerText.includes('schedule a call') ||
    lowerText.includes('follow up')
  ) {
    let taskTitle = text;
    
    // Extract task title from various patterns
    if (lowerText.startsWith('task:')) taskTitle = text.substring(5).trim();
    else if (lowerText.startsWith('todo:')) taskTitle = text.substring(5).trim();
    else if (lowerText.includes('remind me to')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('remind me to') + 12).trim();
    } else if (lowerText.includes('remind me')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('remind me') + 9).trim();
    } else if (lowerText.includes('create task')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('create task') + 11).trim();
    } else if (lowerText.includes('add task')) {
      taskTitle = text.substring(text.toLowerCase().indexOf('add task') + 8).trim();
    }
    
    // Clean up task title
    taskTitle = taskTitle.replace(/^(to|for)\s+/i, '').trim();
    
    const dueDate = extractDate(text);

    // Create the task immediately
    const task = await prisma.task.create({
      data: {
        agentId,
        title: taskTitle,
        dueAt: dueDate,
        dealId: context?.dealId || null,
        clientId: context?.clientId || null,
        createdFrom: TaskCreatedFrom.AI_SUGGESTED,
      },
    });

    return {
      intent: 'CREATE_TASK',
      confidence: 0.95,
      actions: [
        {
          type: 'TASK_CREATED',
          parameters: { taskId: task.id, title: taskTitle, dueAt: dueDate?.toISOString() },
          description: `Created task: "${taskTitle}"`,
        },
      ],
      messages: [
        `✅ Created task: "${taskTitle}"${dueDate ? ` - due ${dueDate.toLocaleDateString()}` : ''}.`,
      ],
      requiresConfirmation: false,
      data: { task },
    };
  }

  // ============================================================
  // CLIENT LOOKUP - "find client", "look up", "client info"
  // ============================================================
  if (
    lowerText.includes('find client') ||
    lowerText.includes('look up client') ||
    lowerText.includes('client info') ||
    lowerText.includes('search client') ||
    lowerText.match(/who is (\w+)/i)
  ) {
    // Extract name to search
    const nameMatch = text.match(/(?:find|look up|search|who is)\s*(?:client)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    const searchName = nameMatch ? nameMatch[1].trim() : '';
    
    if (searchName) {
      const clients = await prisma.client.findMany({
        where: {
          agentId,
          OR: [
            { firstName: { contains: searchName, mode: 'insensitive' } },
            { lastName: { contains: searchName, mode: 'insensitive' } },
            { email: { contains: searchName, mode: 'insensitive' } },
          ],
        },
        take: 5,
        include: {
          buyerDeals: { take: 3 },
          sellerDeals: { take: 3 },
        },
      });

      if (clients.length > 0) {
        return {
          intent: 'CLIENT_LOOKUP',
          confidence: 0.9,
          actions: [
            {
              type: 'SHOW_CLIENTS',
              parameters: { query: searchName },
              description: `Found ${clients.length} client(s)`,
              data: clients,
            },
          ],
          messages: [
            `Found ${clients.length} client(s) matching "${searchName}":`,
            ...clients.map(c => `• ${c.firstName} ${c.lastName} - ${c.email || 'No email'} (${c.stage})`),
          ],
          requiresConfirmation: false,
          data: { clients },
        };
      }
    }

    return {
      intent: 'CLIENT_LOOKUP',
      confidence: 0.7,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/clients' },
          description: 'Open clients page',
        },
      ],
      messages: [
        searchName ? `No clients found matching "${searchName}".` : 'Who are you looking for?',
        'Try: "Find client John" or "Look up Smith"',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // LEAD MANAGEMENT - "new lead", "add lead", "hot lead"
  // ============================================================
  if (
    lowerText.includes('new lead') ||
    lowerText.includes('add lead') ||
    lowerText.includes('hot lead') ||
    lowerText.includes('create lead')
  ) {
    return {
      intent: 'LEAD_MANAGEMENT',
      confidence: 0.85,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/leads' },
          description: 'Open leads dashboard',
        },
      ],
      messages: [
        'Opening the Leads Dashboard where you can manage all your leads.',
        'Hot tip: Set up landing pages to capture leads automatically!',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // MARKETING - "create blast", "marketing", "promote", "social"
  // ============================================================
  if (
    lowerText.includes('marketing') ||
    lowerText.includes('create blast') ||
    lowerText.includes('email blast') ||
    lowerText.includes('promote') ||
    lowerText.includes('social media') ||
    lowerText.includes('just listed') ||
    lowerText.includes('open house')
  ) {
    return {
      intent: 'MARKETING',
      confidence: 0.85,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/marketing' },
          description: 'Open marketing hub',
        },
      ],
      messages: [
        'Opening Marketing Hub - create email blasts, social posts, and more!',
        'I can help you draft marketing copy with AI.',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // CALENDAR & SCHEDULE - "my calendar", "what's today", "this week"
  // ============================================================
  if (
    lowerText.includes('calendar') ||
    lowerText.includes('my schedule') ||
    lowerText.includes("what's today") ||
    lowerText.includes('this week') ||
    lowerText.includes('upcoming')
  ) {
    // Fetch upcoming tasks and events
    const upcomingTasks = await prisma.task.findMany({
      where: {
        agentId,
        status: 'OPEN',
        dueAt: { gte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    });

    return {
      intent: 'CALENDAR',
      confidence: 0.9,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/calendar' },
          description: 'Open calendar',
        },
      ],
      messages: [
        upcomingTasks.length > 0 
          ? `You have ${upcomingTasks.length} upcoming tasks:`
          : 'Your schedule looks clear!',
        ...upcomingTasks.slice(0, 3).map(t => 
          `• ${t.title}${t.dueAt ? ` - ${new Date(t.dueAt).toLocaleDateString()}` : ''}`
        ),
      ],
      requiresConfirmation: false,
      data: { tasks: upcomingTasks },
    };
  }

  // ============================================================
  // SUMMARY / DASHBOARD - "summarize", "overview", "how am I doing"
  // ============================================================
  if (
    lowerText.includes('summarize') ||
    lowerText.includes('summary') ||
    lowerText.includes('overview') ||
    lowerText.includes('how am i doing') ||
    lowerText.includes("what's happening") ||
    lowerText.includes('dashboard')
  ) {
    // Gather stats
    const [activeDeals, openTasks, newLeads, recentClients] = await Promise.all([
      prisma.deal.count({ where: { agentId, status: { in: ['ACTIVE', 'UNDER_CONTRACT'] } } }),
      prisma.task.count({ where: { agentId, status: 'OPEN' } }),
      prisma.lead.count({ where: { agentId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.client.count({ where: { agentId, stage: 'ACTIVE' } }),
    ]);

    return {
      intent: 'SUMMARY',
      confidence: 0.9,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/dashboard' },
          description: 'Open dashboard',
        },
      ],
      messages: [
        '📊 Here\'s your quick summary:',
        `• ${activeDeals} active deal${activeDeals !== 1 ? 's' : ''}`,
        `• ${openTasks} open task${openTasks !== 1 ? 's' : ''}`,
        `• ${newLeads} new lead${newLeads !== 1 ? 's' : ''} this week`,
        `• ${recentClients} active client${recentClients !== 1 ? 's' : ''}`,
      ],
      requiresConfirmation: false,
      data: { stats: { activeDeals, openTasks, newLeads, recentClients } },
    };
  }

  // ============================================================
  // LISTINGS - "my listings", "active listings", "new listing"
  // ============================================================
  if (
    lowerText.includes('my listings') ||
    lowerText.includes('active listings') ||
    lowerText.includes('new listing') ||
    lowerText.includes('add listing')
  ) {
    const listings = await prisma.listing.findMany({
      where: { agentId, status: 'ACTIVE' },
      take: 5,
    });

    return {
      intent: 'LISTINGS',
      confidence: 0.85,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/listings' },
          description: 'Open listings',
        },
      ],
      messages: [
        listings.length > 0 
          ? `You have ${listings.length} active listing${listings.length !== 1 ? 's' : ''}:`
          : 'No active listings.',
        ...listings.slice(0, 3).map(l => `• ${l.headline || 'Untitled'} - $${l.price ? Number(l.price).toLocaleString() : 'TBD'}`),
      ],
      requiresConfirmation: false,
      data: { listings },
    };
  }

  // ============================================================
  // AUTOMATIONS - "set up automation", "automate", "auto"
  // ============================================================
  if (
    lowerText.includes('automation') ||
    lowerText.includes('automate') ||
    lowerText.includes('set up auto')
  ) {
    return {
      intent: 'AUTOMATIONS',
      confidence: 0.8,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/automations' },
          description: 'Open automations',
        },
      ],
      messages: [
        'Opening Automations - set up smart workflows to save time!',
        'Examples: Auto-create tasks when a deal is created, send follow-up reminders.',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // SETTINGS - "settings", "preferences", "profile"
  // ============================================================
  if (
    lowerText.includes('setting') ||
    lowerText.includes('preference') ||
    lowerText.includes('my profile') ||
    lowerText.includes('branding')
  ) {
    return {
      intent: 'SETTINGS',
      confidence: 0.85,
      actions: [
        {
          type: 'NAVIGATE',
          parameters: { route: '/settings' },
          description: 'Open settings',
        },
      ],
      messages: ['Opening Settings - customize your profile, branding, and integrations.'],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // HELP - "help", "what can you do", "commands"
  // ============================================================
  if (
    lowerText.includes('help') ||
    lowerText.includes('what can you do') ||
    lowerText.includes('commands') ||
    lowerText.includes('how do i')
  ) {
    return {
      intent: 'HELP',
      confidence: 1.0,
      actions: [],
      messages: [
        '🚀 I can help you with:',
        '🔍 **Property Search**: "Find homes in Park City under 800k"',
        '📝 **Create Deals**: "New deal for 123 Main St at 450k"',
        '✅ **Tasks**: "Task: Call lender tomorrow"',
        '👥 **Clients**: "Find client John Smith"',
        '📊 **Summary**: "What\'s happening this week"',
        '📅 **Calendar**: "Show my schedule"',
        '📣 **Marketing**: "Create email blast"',
        '⚡ **Automations**: "Set up automation"',
      ],
      requiresConfirmation: false,
    };
  }

  // ============================================================
  // FALLBACK - Unknown intent
  // ============================================================
  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    actions: [],
    messages: [
      'I\'m not sure what you need. Try:',
      '• "Search homes in Salt Lake City under 500k"',
      '• "Create task: Follow up with buyer"',
      '• "Find client John"',
      '• "What\'s happening this week"',
      '• Type "help" for all commands',
    ],
    requiresConfirmation: false,
  };
}
