import { FormDefinition } from '@prisma/client';

// Heuristic helpers for stub AI parsing
function parseMoney(text: string): number | null {
  // Match patterns like 550k, $550,000, 550000
  const moneyRegex = /\$?([\d,]+)(k)?/i;
  const match = text.replace(/\s+/g, '').match(moneyRegex);
  if (!match) return null;
  let raw = match[1].replace(/,/g, '');
  let value = parseInt(raw, 10);
  if (match[2]) value = value * 1000; // 'k' suffix
  if (isNaN(value)) return null;
  return value;
}

// Extract money amounts with their context labels
function parseMoneyWithContext(text: string): Array<{ amount: number; context: string }> {
  const results: Array<{ amount: number; context: string }> = [];
  // Find all money patterns with surrounding context
  // Patterns: "550k price", "$550,000 purchase", "10k earnest", "earnest 5500", etc.
  const patterns = [
    // Amount before label: "550k price", "10k earnest"
    /\$?([\d,]+)(k)?\s*(price|purchase|earnest|offer)/gi,
    // Label before amount: "price 550k", "earnest money 10k", "purchase price $550,000"
    /(price|purchase|earnest|offer)\s*(?:money|price)?\s*(?:of|is|:)?\s*\$?([\d,]+)(k)?/gi,
  ];
  
  // Try first pattern: amount then label
  const pattern1 = /\$?([\d,]+)(k)?\s*(price|purchase|earnest|offer)/gi;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    let value = parseInt(match[1].replace(/,/g, ''), 10);
    if (match[2]) value *= 1000;
    if (!isNaN(value)) {
      results.push({ amount: value, context: match[3].toLowerCase() });
    }
  }
  
  // Try second pattern: label then amount  
  const pattern2 = /(price|purchase|earnest|offer)\s*(?:money|price)?\s*(?:of|is|:)?\s*\$?([\d,]+)(k)?/gi;
  while ((match = pattern2.exec(text)) !== null) {
    let value = parseInt(match[2].replace(/,/g, ''), 10);
    if (match[3]) value *= 1000;
    if (!isNaN(value)) {
      const ctx = match[1].toLowerCase();
      // Don't add duplicates
      if (!results.find(r => r.context === ctx && r.amount === value)) {
        results.push({ amount: value, context: ctx });
      }
    }
  }
  
  return results;
}

function parseDaysOffset(text: string): number | null {
  const m = text.match(/(\d+)\s*days?/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseDateNatural(text: string): Date | null {
  // Try direct Date parse first
  const direct = new Date(text);
  if (!isNaN(direct.getTime())) return direct;
  // Patterns like 'June 20', 'Jun 5', 'Nov 18 2025'
  const monthDayRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:[,\s]*(\d{4}))?/i;
  const md = text.match(monthDayRegex);
  if (md) {
    const monthName = md[1];
    const day = parseInt(md[2], 10);
    const year = md[3] ? parseInt(md[3], 10) : new Date().getFullYear();
    const monthIndex = [
      'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'
    ].indexOf(monthName.substring(0,3).toLowerCase());
    if (monthIndex >= 0) {
      const d = new Date(year, monthIndex, day);
      return d;
    }
  }
  return null;
}

function parseNameList(text: string, label: string): string | null {
  const regex = new RegExp(`${label}s?\\s*(?:are|is|=|:)?\\s*([^.;\n]+)`, 'i');
  const match = text.match(regex);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ');
}

function parseCityStateZip(text: string): { city?: string; state?: string; zip?: string } {
  const match = text.match(/([a-z\s]+),\s*([a-z]{2})\s*(\d{5})?/i);
  if (!match) return {};
  return {
    city: match[1].trim(),
    state: match[2].toUpperCase(),
    zip: match[3],
  };
}

function parseTime(text: string): { time?: string; meridiem?: 'AM' | 'PM' } {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return {};
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = (match[3] || '').toUpperCase() as 'AM' | 'PM' | '';

  if (!meridiem) {
    const padded = String(hours).padStart(2, '0');
    const time = `${padded}:${String(minutes).padStart(2, '0')}`;
    return { time };
  }

  if (hours === 12) hours = 0;
  if (meridiem === 'PM') hours += 12;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { time, meridiem };
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export async function aiInterpretFormAnswer(input: {
  agentId: string;
  formDefinition: FormDefinition;
  question: { id: string; label: string; targets: string[] };
  formData: any;
  answerText: string;
}): Promise<{ updates: Record<string, any>; explanation: string }> {
  const { targets, answerText } = input.question ? { targets: input.question.targets, answerText: input.answerText } : { targets: [], answerText: input.answerText };
  const updates: Record<string, any> = {};
  let explanationParts: string[] = [];

  for (const target of targets) {
    // Monetary fields
    if (/price|earnest|concession/i.test(target)) {
      const money = parseMoney(answerText);
      if (money !== null) {
        updates[target] = money;
        explanationParts.push(`Parsed $${money.toLocaleString()} for ${target}.`);
        continue;
      }
    }
    // Date/deadline fields
    if (/deadline|date|expiration/i.test(target)) {
      const days = parseDaysOffset(answerText);
      if (days !== null) {
        const base = new Date();
        const dt = addDays(base, days);
        updates[target] = dt.toISOString();
        explanationParts.push(`Interpreted "${days} days" → ${dt.toISOString().slice(0,10)} for ${target}.`);
        continue;
      }
      const parsedDate = parseDateNatural(answerText);
      if (parsedDate) {
        updates[target] = parsedDate.toISOString();
        explanationParts.push(`Interpreted natural date → ${parsedDate.toISOString().slice(0,10)} for ${target}.`);
        continue;
      }
    }
    // Possession timing
    if (target === 'possessionTiming') {
      if (/on\s*recording/i.test(answerText)) updates[target] = 'ON_RECORDING';
      else if (/hours?/i.test(answerText)) updates[target] = 'HOURS_AFTER_RECORDING';
      else if (/days?/i.test(answerText)) updates[target] = 'DAYS_AFTER_RECORDING';
      else updates[target] = 'ON_RECORDING';
      explanationParts.push(`Set possession timing to ${updates[target]}.`);
      continue;
    }
    if (target === 'possessionOffset') {
      const daysOrHours = parseDaysOffset(answerText);
      if (daysOrHours !== null) {
        updates[target] = daysOrHours;
        explanationParts.push(`Set possession offset to ${daysOrHours}.`);
        continue;
      }
    }
    // Fallback: store raw text
    updates[target] = answerText.trim();
    explanationParts.push(`Captured text for ${target}.`);
  }

  if (explanationParts.length === 0) {
    explanationParts.push('No structured fields parsed; stored raw answer text.');
  }

  return {
    updates,
    explanation: explanationParts.join(' ')
  };
}

export async function aiSmartFormPrompt(input: {
  agentId: string;
  formDefinition: FormDefinition;
  formData: any;
  naturalText: string;
}): Promise<{ updates: Record<string, any>; explanation: string }> {
  const rawText = input.naturalText || '';
  const text = rawText.toLowerCase();
  const updates: Record<string, any> = {};
  const notes: string[] = [];

  // Parse money amounts with their context (e.g., "550k price, 10k earnest")
  const moneyItems = parseMoneyWithContext(text);
  
  for (const item of moneyItems) {
    if (item.context === 'price' || item.context === 'purchase' || item.context === 'offer') {
      updates.purchasePrice = item.amount;
      notes.push(`Purchase price → $${item.amount.toLocaleString()}`);
    } else if (item.context === 'earnest') {
      updates.earnestMoneyAmount = item.amount;
      notes.push(`Earnest money → $${item.amount.toLocaleString()}`);
    }
  }
  
  // Fallback: if no contextual money found, try simple parse for just price
  if (!updates.purchasePrice && !updates.earnestMoneyAmount) {
    const price = parseMoney(text);
    if (price) {
      // Assume standalone number is purchase price
      updates.purchasePrice = price;
      notes.push(`Purchase price → $${price.toLocaleString()}`);
    }
  }

  // Due diligence X days
  if (/due diligence/.test(text)) {
    const ddDays = parseDaysOffset(text);
    if (ddDays) {
      const ddDate = addDays(new Date(), ddDays);
      updates.dueDiligenceDeadline = ddDate.toISOString();
      notes.push(`Due diligence deadline → ${ddDate.toISOString().slice(0,10)}`);
    }
  }
  // Settlement date natural
  if (/close|settle|settlement/.test(text)) {
    const settleDays = parseDaysOffset(text);
    if (settleDays) {
      const stDate = addDays(new Date(), settleDays);
      updates.settlementDeadline = stDate.toISOString();
      notes.push(`Settlement deadline (days) → ${stDate.toISOString().slice(0,10)}`);
    } else {
      const nat = parseDateNatural(text);
      if (nat) {
        updates.settlementDeadline = nat.toISOString();
        notes.push(`Settlement deadline (natural) → ${nat.toISOString().slice(0,10)}`);
      }
    }
  }
  // Financing deadline
  if (/financing|loan|appraisal/.test(text) && /\d+\s*days?/.test(text)) {
    const finDays = parseDaysOffset(text);
    if (finDays) {
      const finDate = addDays(new Date(), finDays);
      updates.financingAppraisalDeadline = finDate.toISOString();
      notes.push(`Financing deadline → ${finDate.toISOString().slice(0,10)}`);
    }
  }
  // Offer expiration
  if (/offer|expires|expiration/.test(text)) {
    const offerDays = parseDaysOffset(text);
    if (offerDays) {
      const offerDate = addDays(new Date(), offerDays);
      updates.offerExpirationDate = offerDate.toISOString();
      notes.push(`Offer expiration date → ${offerDate.toISOString().slice(0,10)}`);
    } else {
      const nat = parseDateNatural(rawText);
      if (nat) {
        updates.offerExpirationDate = nat.toISOString();
        notes.push(`Offer expiration date → ${nat.toISOString().slice(0,10)}`);
      }
    }
    const timeParsed = parseTime(rawText);
    if (timeParsed.time) {
      updates.offerExpirationTime = timeParsed.time;
      if (timeParsed.meridiem) updates.offerExpirationMeridiem = timeParsed.meridiem;
      notes.push('Offer expiration time updated.');
    }
  }
  // Buyer/Seller names
  const buyerNames = parseNameList(rawText, 'buyer');
  if (buyerNames) {
    updates.buyerLegalNames = buyerNames;
    notes.push(`Buyer names → ${buyerNames}`);
  }
  const sellerNames = parseNameList(rawText, 'seller');
  if (sellerNames) {
    updates.sellerLegalNames = sellerNames;
    notes.push(`Seller names → ${sellerNames}`);
  }
  // Address city/state/zip
  if (/(city|state|zip|address)/.test(text)) {
    const parsed = parseCityStateZip(rawText);
    if (parsed.city) {
      updates.propertyCity = parsed.city;
      notes.push(`City → ${parsed.city}`);
    }
    if (parsed.state) {
      updates.propertyState = parsed.state;
      notes.push(`State → ${parsed.state}`);
    }
    if (parsed.zip) {
      updates.propertyZip = parsed.zip;
      notes.push(`ZIP → ${parsed.zip}`);
    }
  }
  // County
  const countyMatch = rawText.match(/county\s*(?:is|:)?\s*([a-z\s]+)/i);
  if (countyMatch && countyMatch[1]) {
    const county = countyMatch[1].trim();
    if (county) {
      updates.propertyCounty = county;
      notes.push(`County → ${county}`);
    }
  }
  // Earnest money form
  if (/earnest/.test(text) && /wire|check|cash/.test(text)) {
    if (/wire/.test(text)) updates.earnestMoneyForm = 'wire';
    if (/check/.test(text)) updates.earnestMoneyForm = 'check';
    if (/cash/.test(text)) updates.earnestMoneyForm = 'cash';
    notes.push('Earnest money form updated.');
  }
  // Possession
  if (/possession/.test(text)) {
    if (/on\s*recording/.test(text)) updates.possessionTiming = 'ON_RECORDING';
    else if (/day|days/.test(text)) updates.possessionTiming = 'DAYS_AFTER_RECORDING';
    else if (/hour|hours/.test(text)) updates.possessionTiming = 'HOURS_AFTER_RECORDING';
    const off = parseDaysOffset(text);
    if (off) updates.possessionOffset = off;
    notes.push('Updated possession timing/offset.');
  }

  if (Object.keys(updates).length === 0) {
    notes.push('No structured values confidently parsed; please refine your prompt.');
  }

  return { updates, explanation: notes.join(' ') };
}

export async function aiSuggestFormsForScenario(input: {
  agentId: string;
  scenario: string;
  dealId?: string;
}): Promise<{ suggestedFormCodes: string[]; rationale: string }> {
  return {
    suggestedFormCodes: ['REPC', 'REPC_ADDENDUM'],
    rationale:
      'Stub AI: Based on your description, a standard Utah REPC plus an addendum for custom terms is often used. This is placeholder logic only and not legal advice.',
  };
}

export async function aiAssistFormFilling(input: {
  agentId: string;
  dealId: string;
  formDefinition: FormDefinition;
  currentData: any;
  naturalLanguagePrompt: string;
}): Promise<{ updatedData: any; explanation: string }> {
  return {
    updatedData: input.currentData,
    explanation:
      'Stub AI: This would normally adjust fields based on your prompt. Please review and edit fields manually. This is not legal advice.',
  };
}

export async function aiExplainSection(input: {
  formCode: string;
  sectionId: string;
  currentData?: any;
  audience: 'agent' | 'client';
}): Promise<{ explanation: string }> {
  return {
    explanation:
      `Stub AI: This section (${input.sectionId}) of form ${input.formCode} typically outlines responsibilities and timelines. This plain-language summary is for convenience only and is not legal advice.`,
  };
}

export async function aiDraftClause(input: {
  dealId: string;
  instructions: string;
}): Promise<{ clauseText: string; notes: string }> {
  return {
    clauseText:
      'Stub AI clause: [Add your custom language here describing the agreed change. Ensure this text is reviewed by your broker and attorney before use.]',
    notes:
      'Stub AI: This suggested clause is a non-lawyer draft. It must be reviewed and approved by appropriate legal and brokerage professionals.',
  };
}

export async function aiDraftListingCopy(input: {
  listingId: string;
  style: 'short' | 'detailed' | 'social';
}): Promise<{ headline: string; body: string; socialCaptions: string[] }> {
  const headline =
    'Stub AI: Move-in-ready Utah home with strong curb appeal (headline only, edit before use)';
  const body =
    'Stub AI: Draft marketing description for this Utah property. Highlight location, light, layout, and lifestyle benefits. Replace this text with your own compliant copy before publishing.';
  const socialCaptions = [
    'Stub AI: New Utah listing – contact me for details. (Edit before posting)',
    'Stub AI: Fresh on the market in Utah – verify all details before sharing.',
  ];

  return { headline, body, socialCaptions };
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if ('toNumber' in (value as any) && typeof (value as any).toNumber === 'function') {
    return (value as any).toNumber();
  }
  return null;
}

function fmtCurrency(value: number | null): string {
  if (value === null) return 'Contact for details';
  return `$${value.toLocaleString()}`;
}

export async function aiDraftMarketingCopy(input: {
  listing: any;
  playbook: string;
}): Promise<{
  social: string;
  linkedin: string;
  emailSubject: string;
  emailBodyHtml: string;
  sms: string;
  websiteIntro: string;
}> {
  const listing = input.listing ?? {};
  const address = listing.headline || listing.description?.split('.')[0] || 'this property';
  const priceValue = safeNumber(listing.price);
  const priceText = fmtCurrency(priceValue);
  const summary = (listing.description as string) || 'Modern finishes, bright living spaces, and turnkey condition.';

  const playbookHook: Record<string, string> = {
    NEW_LISTING: 'Fresh on the market',
    PRICE_REDUCTION: 'New price alert',
    OPEN_HOUSE: 'Open house invite',
    UNDER_CONTRACT: 'Under contract momentum',
    JUST_SOLD: 'Just sold update',
    CUSTOM: 'Spotlight',
  };

  const hook = playbookHook[input.playbook] || 'Property spotlight';
  const callToAction = 'Message me to schedule a private tour or get the digital brochure.';

  return {
    social: `${hook}! ${address} is available for ${priceText}. ${summary} ${callToAction}`.trim(),
    linkedin: `${hook}: ${address}. ${summary} Listed at ${priceText}. ${callToAction}`.trim(),
    emailSubject: `${hook} – ${address}`,
    emailBodyHtml: `<!doctype html><body style="font-family:Inter,Arial,sans-serif;background:#020617;color:#0f172a;padding:24px;">
      <h2 style="margin:0 0 12px;font-size:24px;color:#fff;">${address}</h2>
      <p style="margin:0 0 8px;color:#cbd5f5;">${summary}</p>
      <p style="margin:0 0 16px;color:#f8fafc;">Offered at <strong>${priceText}</strong>.</p>
      <p style="margin:0;color:#cbd5f5;">${callToAction}</p>
    </body>`,
    sms: `${hook}: ${address} at ${priceText}. ${callToAction}`,
    websiteIntro: `<p><strong>${hook}</strong> — ${summary} Listed at ${priceText}. ${callToAction}</p>`,
  };
}
