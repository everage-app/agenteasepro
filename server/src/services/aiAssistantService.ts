import { createAIChatCompletion, isAIConfigured } from '../lib/aiClient';

interface RepcAssistResponse {
  suggestions: Array<{
    field: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  missingFields: string[];
  nextSteps: string[];
}

export async function assistWithRepc(
  formValues: Record<string, any>,
  context?: string
): Promise<RepcAssistResponse> {
  try {
    if (!isAIConfigured()) {
      // Return mock response if no AI client
      return {
        suggestions: [
          { field: 'settlementDeadline', suggestion: 'Consider setting this 30-45 days out', priority: 'medium' },
          { field: 'earnestMoney', suggestion: 'Typical earnest money is 1-2% of purchase price', priority: 'low' }
        ],
        missingFields: ['sellerName', 'purchasePrice'],
        nextSteps: ['Complete all required fields', 'Review deadlines with client']
      };
    }
    
    const prompt = `You are an assistant for Utah real estate agents working on REPC forms.

Current form data: ${JSON.stringify(formValues, null, 2)}
${context ? `Additional context: ${context}` : ''}

Review the form and provide:
1. Missing or incomplete fields that are typically required
2. Suggestions for deadlines and tasks based on the dates filled in
3. Next steps the agent should take

Respond in JSON format:
{
  "suggestions": [{"field": "string", "suggestion": "string", "priority": "high|medium|low"}],
  "missingFields": ["field names"],
  "nextSteps": ["action items"]
}

Keep suggestions brief, agent-friendly, and specific to Utah real estate practices. Do not provide legal advice.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for Utah real estate agents. Provide brief, practical suggestions. Never give legal advice.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{}');
    return response as RepcAssistResponse;
  } catch (error) {
    console.error('AI assist error:', error);
    // Fallback response
    return {
      suggestions: [],
      missingFields: [],
      nextSteps: ['Review form manually', 'Check all required fields'],
    };
  }
}

interface TaskSuggestion {
  title: string;
  description: string;
  category: 'contract' | 'marketing' | 'client_followup';
  priority: 'high' | 'medium' | 'low';
  dueInDays?: number;
}

export async function suggestTasksForEvent(
  eventType: string,
  payload: Record<string, any>
): Promise<TaskSuggestion[]> {
  try {
    if (!isAIConfigured()) {
      return [
         { title: 'Review Contract Documents', description: 'Ensure all signatures are collected.', category: 'contract', priority: 'high', dueInDays: 1 },
         { title: 'Contact Client', description: 'Update client on current status.', category: 'client_followup', priority: 'medium', dueInDays: 0 },
         { title: 'Update internal records', description: 'Log the new event in the CRM.', category: 'contract', priority: 'low', dueInDays: 2 }
      ];
    }
    
    const prompt = `You are an assistant helping Utah real estate agents manage their tasks.

Event: ${eventType}
Details: ${JSON.stringify(payload, null, 2)}

Suggest 3-5 specific tasks the agent should do next. For each task:
- title: Short action title (5-8 words)
- description: Brief 1-2 sentence description
- category: "contract", "marketing", or "client_followup"
- priority: "high", "medium", or "low"
- dueInDays: number of days from now (optional)

Respond in JSON array format:
[{"title": "string", "description": "string", "category": "string", "priority": "string", "dueInDays": number}]

Keep task titles action-oriented and specific to Utah real estate workflows.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful task planning assistant for real estate agents. Suggest practical, specific tasks.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 400,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{"tasks":[]}');
    return (response.tasks || response) as TaskSuggestion[];
  } catch (error) {
    console.error('Task suggestion error:', error);
    return [];
  }
}

interface ListingDescription {
  short: string;
  long: string;
  highlights: string[];
}

export async function draftListingCopy(listing: {
  address?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  price?: number;
  propertyType?: string;
  features?: string[];
  notes?: string;
}): Promise<ListingDescription> {
  try {
    if (!isAIConfigured()) {
      return {
        short: 'Beautiful property with modern finishes and great location.',
        long: 'This property offers a wonderful opportunity for buyers seeking quality and convenience. With thoughtful design and desirable features, it represents excellent value in today\'s market.',
        highlights: ['Prime location', 'Modern updates', 'Move-in ready'],
      };
    }
    
    const prompt = `You are a real estate copywriter helping a Utah agent draft listing descriptions.

Property details:
- Address: ${listing.address || 'Not specified'}
- Beds: ${listing.beds || 'N/A'}
- Baths: ${listing.baths || 'N/A'}
- Sq Ft: ${listing.sqft || 'N/A'}
- Price: ${listing.price ? `$${listing.price.toLocaleString()}` : 'N/A'}
- Type: ${listing.propertyType || 'Residential'}
- Features: ${listing.features?.join(', ') || 'None listed'}
- Notes: ${listing.notes || 'None'}

Create:
1. Short description (50-75 words) - punchy, highlights key features
2. Long description (150-200 words) - detailed, lifestyle-focused
3. 3-5 bullet point highlights

Respond in JSON format:
{
  "short": "string",
  "long": "string",
  "highlights": ["string"]
}

Use engaging, professional language. Avoid clichés. Focus on concrete features and Utah lifestyle benefits.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a professional real estate copywriter. Write clear, engaging descriptions that agents can edit and customize.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 600,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{}');
    return response as ListingDescription;
  } catch (error) {
    console.error('Listing copy generation error:', error);
    return {
      short: 'Beautiful property with modern finishes and great location.',
      long: 'This property offers a wonderful opportunity for buyers seeking quality and convenience. With thoughtful design and desirable features, it represents excellent value in today\'s market.',
      highlights: ['Prime location', 'Modern updates', 'Move-in ready'],
    };
  }
}

interface MarketingCopy {
  emailSubject: string;
  emailBody: string;
  socialCaption: string;
}

export async function draftMarketingCopy(context: {
  type: 'new_listing' | 'open_house' | 'price_drop' | 'just_sold';
  property?: {
    address?: string;
    price?: number;
    beds?: number;
    baths?: number;
  };
  details?: string;
}): Promise<MarketingCopy> {
  try {
    if (!isAIConfigured()) {
      return {
        emailSubject: 'New Listing Alert – Don\'t Miss This One!',
        emailBody: 'I\'m excited to share a fantastic new listing that just hit the market. This property offers everything you\'ve been looking for. Contact me today to schedule a private showing before it\'s gone!',
        socialCaption: '🏡 New listing alert! Beautiful property just hit the market. DM me for details and to schedule your private tour. #UtahRealEstate',
      };
    }
    
    const typeLabels = {
      new_listing: 'New Listing',
      open_house: 'Open House',
      price_drop: 'Price Reduction',
      just_sold: 'Just Sold',
    };
    
    const prompt = `You are drafting marketing copy for a Utah real estate agent.

Campaign type: ${typeLabels[context.type]}
Property: ${context.property?.address || 'Property address'}
Price: ${context.property?.price ? `$${context.property.price.toLocaleString()}` : 'TBD'}
Beds/Baths: ${context.property?.beds || 'N/A'} / ${context.property?.baths || 'N/A'}
Additional details: ${context.details || 'None'}

Create:
1. Email subject line (6-10 words, compelling)
2. Email body (100-150 words, warm and professional)
3. Social media caption (40-60 words, includes call to action)

Respond in JSON format:
{
  "emailSubject": "string",
  "emailBody": "string",
  "socialCaption": "string"
}

Keep the tone friendly but professional. Focus on creating urgency and interest.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a marketing copywriter for real estate. Write engaging, concise copy that drives action.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 500,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{}');
    return response as MarketingCopy;
  } catch (error) {
    console.error('Marketing copy generation error:', error);
    return {
      emailSubject: 'New Listing Alert – Don\'t Miss This One!',
      emailBody: 'I\'m excited to share a fantastic new listing that just hit the market. This property offers everything you\'ve been looking for. Contact me today to schedule a private showing before it\'s gone!',
      socialCaption: '🏡 New listing alert! Beautiful property just hit the market. DM me for details and to schedule your private tour. #UtahRealEstate',
    };
  }
}

interface DealSummary {
  status: string;
  keyDates: Array<{ label: string; date: string; daysUntil: number }>;
  nextActions: string[];
  concerns: string[];
}

export async function summarizeDeal(dealData: Record<string, any>): Promise<DealSummary> {
  try {
    if (!isAIConfigured()) {
      return {
        status: 'Deal in progress',
        keyDates: [],
        nextActions: ['Review deal details', 'Check upcoming deadlines'],
        concerns: [],
      };
    }
    
    const prompt = `You are helping a Utah real estate agent understand their deal status.

Deal data: ${JSON.stringify(dealData, null, 2)}

Provide a concise summary with:
1. Current status (1 sentence)
2. Key upcoming dates with days until each
3. Next 3-4 actions the agent should take
4. Any concerns or items that need attention

Respond in JSON format:
{
  "status": "string",
  "keyDates": [{"label": "string", "date": "YYYY-MM-DD", "daysUntil": number}],
  "nextActions": ["string"],
  "concerns": ["string"]
}

Be specific and actionable. Focus on what the agent needs to do next.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a deal management assistant for real estate agents. Provide clear, actionable summaries.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 400,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{}');
    return response as DealSummary;
  } catch (error) {
    console.error('Deal summary error:', error);
    return {
      status: 'Deal in progress',
      keyDates: [],
      nextActions: ['Review deal details', 'Check upcoming deadlines'],
      concerns: [],
    };
  }
}

interface DailyPlan {
  priority: Array<{
    title: string;
    type: 'task' | 'deadline' | 'followup';
    relatedTo: string;
    urgency: 'urgent' | 'today' | 'soon';
  }>;
  summary: string;
}

export interface DailyPlanActionUI {
  id: string;
  title: string;
  description: string;
  urgency: 'urgent' | 'today' | 'soon';
  relatedTo?: {
    type: 'deal' | 'task' | 'client' | 'listing';
    id: string;
  };
}

export async function summarizeDailyPlanFromActions(params: {
  date: string;
  actions: Array<Pick<DailyPlanActionUI, 'title' | 'description' | 'urgency'>>;
}): Promise<string> {
  const total = params.actions.length;
  const urgentCount = params.actions.filter(a => a.urgency === 'urgent').length;
  const todayCount = params.actions.filter(a => a.urgency === 'today').length;
  const soonCount = params.actions.filter(a => a.urgency === 'soon').length;

  if (total === 0) {
    return 'No urgent items detected. Review your tasks and calendar to plan your day.';
  }

  if (!isAIConfigured()) {
    const parts: string[] = [];
    if (urgentCount > 0) parts.push(`${urgentCount} urgent item${urgentCount === 1 ? '' : 's'} need attention`);
    if (todayCount > 0) parts.push(`${todayCount} item${todayCount === 1 ? '' : 's'} to handle today`);
    if (soonCount > 0) parts.push(`${soonCount} item${soonCount === 1 ? '' : 's'} coming up soon`);

    return `Today’s focus: ${parts.join(', ')}. Start with deadlines and overdue work, then move into follow-ups.`;
  }

  try {
    const prompt = `You are a productivity assistant for a Utah real estate agent.

Date: ${params.date}

Here are the agent's top actions for the day (already selected):
${JSON.stringify(
  params.actions.map(a => ({ title: a.title, urgency: a.urgency, description: a.description })),
  null,
  2
)}

Write a 2-3 sentence daily summary that is motivating, specific, and prioritizes urgent items first.

Respond in JSON:
{ "summary": "..." }`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a concise productivity coach for real estate agents. Do not provide legal advice.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 180,
      responseFormat: 'json_object',
    });

    const raw = content || '{}';
    const parsed = JSON.parse(raw);
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';
    if (summary) return summary;
  } catch (error) {
    console.error('Daily plan summary generation error:', error);
  }

  return `You have ${urgentCount} urgent priorities and ${todayCount} items to handle today. Start with deadlines first.`;
}

export async function buildDailyPlan(agentData: {
  tasks: any[];
  deals: any[];
  clients: any[];
  date: string;
}): Promise<DailyPlan> {
  try {
    if (!isAIConfigured()) {
      return {
        priority: [],
        summary: 'Review your tasks and calendar to plan your day.',
      };
    }
    
    const prompt = `You are helping a Utah real estate agent plan their day.

Date: ${agentData.date}
Tasks: ${JSON.stringify(agentData.tasks, null, 2)}
Active deals: ${JSON.stringify(agentData.deals, null, 2)}
Clients needing attention: ${JSON.stringify(agentData.clients, null, 2)}

Create a prioritized action plan for today with:
1. Top 5-8 priority items sorted by urgency
2. Brief summary of what the day looks like (2-3 sentences)

Respond in JSON format:
{
  "priority": [{"title": "string", "type": "task|deadline|followup", "relatedTo": "string", "urgency": "urgent|today|soon"}],
  "summary": "string"
}

Focus on time-sensitive contract deadlines first, then client follow-ups, then other tasks.`;

    const content = await createAIChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a productivity assistant for real estate agents. Help them prioritize their day effectively.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
      responseFormat: 'json_object',
    });

    const response = JSON.parse(content || '{}');
    return response as DailyPlan;
  } catch (error) {
    console.error('Daily plan generation error:', error);
    return {
      priority: [],
      summary: 'Review your tasks and calendar to plan your day.',
    };
  }
}

// ============================================
// ENHANCED CONTRACT REVIEW SYSTEM
// ============================================

export interface ContractReviewResult {
  score: number; // 0-100 completeness score
  status: 'incomplete' | 'needs_attention' | 'ready_to_send' | 'excellent';
  
  // Field Analysis
  completedFields: string[];
  missingRequired: Array<{
    field: string;
    label: string;
    severity: 'critical' | 'important' | 'recommended';
    suggestion?: string;
  }>;
  
  // Date Analysis
  dateAnalysis: {
    isValid: boolean;
    issues: Array<{
      type: 'conflict' | 'past_date' | 'tight_timeline' | 'warning';
      message: string;
      fields: string[];
    }>;
    timeline: Array<{
      date: string;
      event: string;
      daysFromNow: number;
      status: 'past' | 'imminent' | 'upcoming' | 'future';
    }>;
  };
  
  // Calculations
  calculations: {
    isValid: boolean;
    items: Array<{
      label: string;
      expected: number;
      actual: number;
      status: 'correct' | 'mismatch' | 'missing';
    }>;
  };
  
  // Risk Assessment
  risks: Array<{
    level: 'high' | 'medium' | 'low';
    category: string;
    description: string;
    recommendation: string;
  }>;
  
  // Suggested Tasks
  suggestedTasks: Array<{
    title: string;
    dueDate?: string;
    linkedToField?: string;
    priority: 'high' | 'medium' | 'low';
    category: 'deadline' | 'document' | 'followup' | 'compliance';
  }>;
  
  // AI Insights
  aiInsights?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
  };
}

// Required fields for Utah REPC
const REPC_REQUIRED_FIELDS = {
  critical: [
    { field: 'buyerLegalNames', label: 'Buyer Legal Names' },
    { field: 'sellerLegalNames', label: 'Seller Legal Names' },
    { field: 'purchasePrice', label: 'Purchase Price' },
    { field: 'earnestMoneyAmount', label: 'Earnest Money Amount' },
    { field: 'settlementDeadline', label: 'Settlement/Closing Date' },
  ],
  important: [
    { field: 'propertyCity', label: 'Property City' },
    { field: 'propertyState', label: 'Property State' },
    { field: 'propertyZip', label: 'Property ZIP' },
    { field: 'propertyCounty', label: 'Property County' },
    { field: 'dueDiligenceDeadline', label: 'Due Diligence Deadline' },
    { field: 'financingAppraisalDeadline', label: 'Financing/Appraisal Deadline' },
    { field: 'sellerDisclosureDeadline', label: 'Seller Disclosure Deadline' },
    { field: 'earnestMoneyForm', label: 'Earnest Money Form' },
  ],
  recommended: [
    { field: 'propertyTaxId', label: 'Property Tax ID/Parcel Number' },
    { field: 'offerExpirationDate', label: 'Offer Expiration Date' },
    { field: 'offerExpirationTime', label: 'Offer Expiration Time' },
    { field: 'possessionTiming', label: 'Possession Timing' },
  ],
};

function analyzeFieldCompleteness(formValues: Record<string, any>): {
  completed: string[];
  missing: ContractReviewResult['missingRequired'];
  score: number;
} {
  const completed: string[] = [];
  const missing: ContractReviewResult['missingRequired'] = [];
  
  const checkField = (field: string, label: string, severity: 'critical' | 'important' | 'recommended') => {
    const value = formValues[field];
    const isEmpty = value === undefined || value === null || value === '' || 
                   (typeof value === 'number' && value === 0 && field !== 'additionalEarnestMoneyAmount');
    
    if (isEmpty) {
      missing.push({
        field,
        label,
        severity,
        suggestion: getSuggestionForField(field, formValues),
      });
    } else {
      completed.push(field);
    }
  };
  
  // Check all field categories
  REPC_REQUIRED_FIELDS.critical.forEach(f => checkField(f.field, f.label, 'critical'));
  REPC_REQUIRED_FIELDS.important.forEach(f => checkField(f.field, f.label, 'important'));
  REPC_REQUIRED_FIELDS.recommended.forEach(f => checkField(f.field, f.label, 'recommended'));
  
  // Calculate score
  const totalFields = Object.values(REPC_REQUIRED_FIELDS).flat().length;
  const criticalCount = REPC_REQUIRED_FIELDS.critical.length;
  const completedCritical = REPC_REQUIRED_FIELDS.critical.filter(f => 
    !missing.find(m => m.field === f.field)
  ).length;
  
  // Weighted score: critical fields worth more
  const criticalScore = (completedCritical / criticalCount) * 50;
  const otherScore = ((completed.length - completedCritical) / (totalFields - criticalCount)) * 50;
  const score = Math.round(criticalScore + otherScore);
  
  return { completed, missing, score };
}

function getSuggestionForField(field: string, formValues: Record<string, any>): string {
  const suggestions: Record<string, string> = {
    earnestMoneyAmount: `Typical earnest money is 1-2% of purchase price${formValues.purchasePrice ? ` (~$${Math.round(formValues.purchasePrice * 0.01).toLocaleString()} - $${Math.round(formValues.purchasePrice * 0.02).toLocaleString()})` : ''}`,
    settlementDeadline: 'Standard closing is 30-45 days from contract acceptance',
    dueDiligenceDeadline: 'Usually 10-14 days from contract acceptance',
    financingAppraisalDeadline: 'Typically 21-30 days for loan and appraisal contingencies',
    sellerDisclosureDeadline: 'Usually 5-7 days from contract acceptance',
    offerExpirationDate: 'Standard is 24-72 hours from offer submission',
    propertyTaxId: 'Find on county assessor website or title report',
  };
  return suggestions[field] || '';
}

function analyzeDates(formValues: Record<string, any>): ContractReviewResult['dateAnalysis'] {
  const issues: ContractReviewResult['dateAnalysis']['issues'] = [];
  const timeline: ContractReviewResult['dateAnalysis']['timeline'] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dateFields = [
    { field: 'offerExpirationDate', label: 'Offer Expiration' },
    { field: 'sellerDisclosureDeadline', label: 'Seller Disclosure' },
    { field: 'dueDiligenceDeadline', label: 'Due Diligence' },
    { field: 'financingAppraisalDeadline', label: 'Financing/Appraisal' },
    { field: 'settlementDeadline', label: 'Settlement/Closing' },
  ];
  
  const parsedDates: Record<string, Date | null> = {};
  
  // Parse all dates
  dateFields.forEach(({ field, label }) => {
    const value = formValues[field];
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        parsedDates[field] = date;
        const daysFromNow = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: 'past' | 'imminent' | 'upcoming' | 'future' = 'future';
        if (daysFromNow < 0) status = 'past';
        else if (daysFromNow <= 3) status = 'imminent';
        else if (daysFromNow <= 14) status = 'upcoming';
        
        timeline.push({
          date: date.toISOString().split('T')[0],
          event: label,
          daysFromNow,
          status,
        });
      }
    }
  });
  
  // Sort timeline
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Check for past dates (excluding offer expiration which may have passed)
  Object.entries(parsedDates).forEach(([field, date]) => {
    if (date && field !== 'offerExpirationDate') {
      const daysFromNow = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysFromNow < 0) {
        issues.push({
          type: 'past_date',
          message: `${dateFields.find(f => f.field === field)?.label} is in the past (${date.toLocaleDateString()})`,
          fields: [field],
        });
      } else if (daysFromNow <= 2) {
        issues.push({
          type: 'warning',
          message: `${dateFields.find(f => f.field === field)?.label} is imminent (${daysFromNow === 0 ? 'TODAY' : `in ${daysFromNow} days`})`,
          fields: [field],
        });
      }
    }
  });
  
  // Check date order logic
  const dd = parsedDates.dueDiligenceDeadline;
  const fa = parsedDates.financingAppraisalDeadline;
  const sd = parsedDates.settlementDeadline;
  
  if (dd && fa && dd > fa) {
    issues.push({
      type: 'conflict',
      message: 'Due Diligence deadline is after Financing/Appraisal deadline',
      fields: ['dueDiligenceDeadline', 'financingAppraisalDeadline'],
    });
  }
  
  if (dd && sd && dd > sd) {
    issues.push({
      type: 'conflict',
      message: 'Due Diligence deadline is after Settlement date',
      fields: ['dueDiligenceDeadline', 'settlementDeadline'],
    });
  }
  
  if (fa && sd && fa > sd) {
    issues.push({
      type: 'conflict',
      message: 'Financing/Appraisal deadline is after Settlement date',
      fields: ['financingAppraisalDeadline', 'settlementDeadline'],
    });
  }
  
  // Check for tight timelines
  if (dd && sd) {
    const ddToClose = Math.ceil((sd.getTime() - dd.getTime()) / (1000 * 60 * 60 * 24));
    if (ddToClose < 14) {
      issues.push({
        type: 'tight_timeline',
        message: `Only ${ddToClose} days between Due Diligence and Settlement (consider more time)`,
        fields: ['dueDiligenceDeadline', 'settlementDeadline'],
      });
    }
  }
  
  return {
    isValid: issues.filter(i => i.type === 'conflict' || i.type === 'past_date').length === 0,
    issues,
    timeline,
  };
}

function analyzeCalculations(formValues: Record<string, any>): ContractReviewResult['calculations'] {
  const items: ContractReviewResult['calculations']['items'] = [];
  
  const purchasePrice = Number(formValues.purchasePrice) || 0;
  const earnestMoney = Number(formValues.earnestMoneyAmount) || 0;
  const additionalEarnest = Number(formValues.additionalEarnestMoneyAmount) || 0;
  const newLoan = Number(formValues.newLoanAmount) || 0;
  const sellerFinancing = Number(formValues.sellerFinancingAmount) || 0;
  const cashAtSettlement = Number(formValues.cashAtSettlement) || 0;
  
  // Check if financing adds up
  if (purchasePrice > 0) {
    const totalFinancing = earnestMoney + additionalEarnest + newLoan + sellerFinancing + cashAtSettlement;
    
    if (newLoan > 0 || cashAtSettlement > 0) {
      items.push({
        label: 'Purchase Price Coverage',
        expected: purchasePrice,
        actual: totalFinancing,
        status: Math.abs(totalFinancing - purchasePrice) < 1 ? 'correct' : 
                totalFinancing === 0 ? 'missing' : 'mismatch',
      });
    }
  }
  
  // Check earnest money percentage
  if (purchasePrice > 0 && earnestMoney > 0) {
    const earnestPercent = (earnestMoney / purchasePrice) * 100;
    items.push({
      label: 'Earnest Money Percentage',
      expected: 1, // 1% minimum typical   
      actual: Math.round(earnestPercent * 100) / 100,
      status: earnestPercent >= 0.5 ? 'correct' : 'mismatch',
    });
  }
  
  return {
    isValid: !items.some(i => i.status === 'mismatch'),
    items,
  };
}

function assessRisks(formValues: Record<string, any>, dateAnalysis: ContractReviewResult['dateAnalysis']): ContractReviewResult['risks'] {
  const risks: ContractReviewResult['risks'] = [];
  
  // Check for missing contingencies
  if (!formValues.hasDueDiligenceCondition) {
    risks.push({
      level: 'medium',
      category: 'Contingencies',
      description: 'No Due Diligence contingency selected',
      recommendation: 'Consider if buyer needs time for inspections and review',
    });
  }
  
  if (!formValues.hasFinancingCondition && !formValues.cashOffer) {
    risks.push({
      level: 'high',
      category: 'Financing',
      description: 'No financing contingency but not marked as cash offer',
      recommendation: 'Verify buyer has financing or is paying cash',
    });
  }
  
  // Date-related risks
  const imminentDeadlines = dateAnalysis.timeline.filter(t => t.status === 'imminent');
  if (imminentDeadlines.length > 0) {
    risks.push({
      level: 'high',
      category: 'Deadlines',
      description: `${imminentDeadlines.length} deadline(s) within 3 days`,
      recommendation: 'Ensure all parties are aware and prepared',
    });
  }
  
  // Subject to sale risk
  if (formValues.isSubjectToSaleOfBuyersProperty) {
    risks.push({
      level: 'medium',
      category: 'Contingencies',
      description: 'Contract is subject to sale of buyer\'s property',
      recommendation: 'Monitor buyer\'s property sale status closely',
    });
  }
  
  return risks;
}

function generateSuggestedTasks(
  formValues: Record<string, any>,
  dateAnalysis: ContractReviewResult['dateAnalysis'],
  missingFields: ContractReviewResult['missingRequired']
): ContractReviewResult['suggestedTasks'] {
  const tasks: ContractReviewResult['suggestedTasks'] = [];
  
  // Tasks from deadlines
  dateAnalysis.timeline.forEach(event => {
    if (event.status !== 'past') {
      const taskDate = new Date(event.date);
      taskDate.setDate(taskDate.getDate() - 1); // Day before deadline
      
      tasks.push({
        title: `Confirm ${event.event} completed`,
        dueDate: taskDate.toISOString().split('T')[0],
        linkedToField: event.event.toLowerCase().replace(/\s+/g, '') + 'Deadline',
        priority: event.status === 'imminent' ? 'high' : event.status === 'upcoming' ? 'medium' : 'low',
        category: 'deadline',
      });
    }
  });
  
  // Tasks from missing critical fields
  const criticalMissing = missingFields.filter(f => f.severity === 'critical');
  if (criticalMissing.length > 0) {
    tasks.push({
      title: `Complete ${criticalMissing.length} required contract fields`,
      priority: 'high',
      category: 'document',
    });
  }
  
  // Standard follow-up tasks
  if (formValues.buyerLegalNames && formValues.sellerLegalNames) {
    tasks.push({
      title: 'Send contract copy to all parties',
      priority: 'medium',
      category: 'followup',
    });
  }
  
  if (formValues.settlementDeadline) {
    const closeDate = new Date(formValues.settlementDeadline);
    const titleOrderDate = new Date(closeDate);
    titleOrderDate.setDate(titleOrderDate.getDate() - 21);
    
    tasks.push({
      title: 'Order title report',
      dueDate: titleOrderDate > new Date() ? titleOrderDate.toISOString().split('T')[0] : undefined,
      priority: 'medium',
      category: 'document',
    });
  }
  
  return tasks.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export async function enhancedContractReview(
  formValues: Record<string, any>,
  options?: { includeAI?: boolean; dealContext?: Record<string, any> }
): Promise<ContractReviewResult> {
  // Analyze field completeness
  const { completed, missing, score } = analyzeFieldCompleteness(formValues);
  
  // Analyze dates
  const dateAnalysis = analyzeDates(formValues);
  
  // Analyze calculations
  const calculations = analyzeCalculations(formValues);
  
  // Assess risks
  const risks = assessRisks(formValues, dateAnalysis);
  
  // Generate suggested tasks
  const suggestedTasks = generateSuggestedTasks(formValues, dateAnalysis, missing);
  
  // Determine overall status
  let status: ContractReviewResult['status'] = 'excellent';
  const criticalMissing = missing.filter(m => m.severity === 'critical').length;
  const hasDateIssues = !dateAnalysis.isValid;
  const hasHighRisks = risks.filter(r => r.level === 'high').length > 0;
  
  if (criticalMissing > 0) {
    status = 'incomplete';
  } else if (hasDateIssues || hasHighRisks) {
    status = 'needs_attention';
  } else if (missing.filter(m => m.severity === 'important').length > 0) {
    status = 'ready_to_send';
  }
  
  // Get AI insights if enabled
  let aiInsights: ContractReviewResult['aiInsights'] | undefined;
  
  if (options?.includeAI) {
    if (isAIConfigured()) {
      try {
        const prompt = `Analyze this Utah REPC form and provide insights:

Form Data: ${JSON.stringify(formValues, null, 2)}
Score: ${score}/100
Missing Fields: ${missing.map(m => m.label).join(', ') || 'None'}
Date Issues: ${dateAnalysis.issues.map(i => i.message).join('; ') || 'None'}
Risks: ${risks.map(r => r.description).join('; ') || 'None'}

Provide:
1. A 1-2 sentence summary of the contract status
2. 2-3 strengths of this contract
3. 2-3 specific improvements needed
4. 3-4 recommended next steps for the agent

Respond in JSON:
{
  "summary": "string",
  "strengths": ["string"],
  "improvements": ["string"],
  "nextSteps": ["string"]
}

Be specific and practical. Reference actual field names and values.`;

        const content = await createAIChatCompletion({
          messages: [
            { role: 'system', content: 'You are a Utah real estate contract review assistant. Provide clear, actionable feedback.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          maxTokens: 500,
          responseFormat: 'json_object',
        });

        aiInsights = JSON.parse(content || '{}');
      } catch (error) {
        console.error('AI insights error:', error);
      }
    }
  }
  
  return {
    score,
    status,
    completedFields: completed,
    missingRequired: missing,
    dateAnalysis,
    calculations,
    risks,
    suggestedTasks,
    aiInsights,
  };
}
