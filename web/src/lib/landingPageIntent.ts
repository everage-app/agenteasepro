export type LandingPageKind = 'listing' | 'agent-profile' | 'seller' | 'buyer' | 'marketing';

export type LandingPageIntent = {
  kind: LandingPageKind;
  storageKind: 'LISTING' | 'AGENT_PROFILE' | 'SELLER_VALUATION' | 'BUYER_CAPTURE' | 'MARKETING';
  label: string;
  shortLabel: string;
  publicLabel: string;
  dashboardDetail: string;
  editorHeading: string;
  editorDescription: string;
  headlineLabel: string;
  headlineHelper: string;
  heroImageHelper: string;
};

type IntentInput = {
  title?: string | null;
  description?: string | null;
  pageKind?: string | null;
  customContent?: any;
  content?: any;
  sections?: any;
  listing?: any;
};

const INTENTS: Record<LandingPageKind, LandingPageIntent> = {
  listing: {
    kind: 'listing',
    storageKind: 'LISTING',
    label: 'Listing Page',
    shortLabel: 'Listing',
    publicLabel: 'Listing Page',
    dashboardDetail: 'Property-first page for ads, QR signs, open houses, and showing requests.',
    editorHeading: 'Customize Listing Page',
    editorDescription: 'Lead with the property, then let the agent card handle trust, branding, and follow-up.',
    headlineLabel: 'Listing Hero Headline',
    headlineHelper: 'Use the address, property hook, or listing benefit. Agent info stays in the presenter card.',
    heroImageHelper: 'Use the strongest property photo or listing gallery image.',
  },
  'agent-profile': {
    kind: 'agent-profile',
    storageKind: 'AGENT_PROFILE',
    label: 'Personal Agent Page',
    shortLabel: 'Personal',
    publicLabel: 'Agent Profile',
    dashboardDetail: 'Personal page for QR cards, bio links, email signatures, and introductions.',
    editorHeading: 'Customize Personal Agent Page',
    editorDescription: 'Lead with the agent, service area, and simple ways for buyers or sellers to connect.',
    headlineLabel: 'Personal Brand Headline',
    headlineHelper: 'Use the agent name, local specialty, or the promise clients should remember.',
    heroImageHelper: 'Use a lifestyle, local market, or brokerage-ready brand image.',
  },
  seller: {
    kind: 'seller',
    storageKind: 'SELLER_VALUATION',
    label: 'Seller Value Page',
    shortLabel: 'Seller',
    publicLabel: 'Home Value Page',
    dashboardDetail: 'Seller lead page for home value reports, pricing strategy, and listing prep.',
    editorHeading: 'Customize Seller Value Page',
    editorDescription: 'Lead with the home value offer and make the next step feel low pressure.',
    headlineLabel: 'Seller Offer Headline',
    headlineHelper: 'Make the value report or selling strategy obvious in one sentence.',
    heroImageHelper: 'Use a polished home exterior, neighborhood, or local market image.',
  },
  buyer: {
    kind: 'buyer',
    storageKind: 'BUYER_CAPTURE',
    label: 'Buyer Capture Page',
    shortLabel: 'Buyer',
    publicLabel: 'Buyer Guide',
    dashboardDetail: 'Buyer lead page for search goals, showing requests, and offer strategy.',
    editorHeading: 'Customize Buyer Capture Page',
    editorDescription: 'Lead with a buyer plan, then capture goals so the agent can follow up fast.',
    headlineLabel: 'Buyer Offer Headline',
    headlineHelper: 'Use a search strategy, showing plan, or local buyer promise.',
    heroImageHelper: 'Use a home, neighborhood, or buyer lifestyle image.',
  },
  marketing: {
    kind: 'marketing',
    storageKind: 'MARKETING',
    label: 'Marketing Page',
    shortLabel: 'Marketing',
    publicLabel: 'Marketing Page',
    dashboardDetail: 'General real estate campaign page for a custom audience or offer.',
    editorHeading: 'Customize Marketing Page',
    editorDescription: 'Lead with the campaign goal and keep the CTA clear.',
    headlineLabel: 'Campaign Headline',
    headlineHelper: 'Use the clearest offer or audience-specific promise.',
    heroImageHelper: 'Use an image that matches the campaign offer.',
  },
};

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKind(value: unknown): LandingPageKind | null {
  const raw = cleanText(value).toUpperCase().replace(/[-\s]+/g, '_');
  if (!raw) return null;
  if (['LISTING', 'LISTING_LAUNCH', 'PROPERTY', 'PROPERTY_LISTING'].includes(raw)) return 'listing';
  if (['AGENT_PROFILE', 'AGENT_PROFILE_DEFAULT', 'PERSONAL', 'PERSONAL_AGENT', 'PROFILE'].includes(raw)) return 'agent-profile';
  if (['SELLER', 'SELLER_VALUATION', 'HOME_VALUE', 'HOME_VALUE_REPORT', 'VALUATION'].includes(raw)) return 'seller';
  if (['BUYER', 'BUYER_CAPTURE', 'BUYER_GUIDE', 'BUYER_GAME_PLAN'].includes(raw)) return 'buyer';
  if (['MARKETING', 'CUSTOM'].includes(raw)) return 'marketing';
  return null;
}

export function looksLikePersonalHeadline(headline: unknown, agentName?: string | null) {
  const text = cleanText(headline);
  if (!text) return false;
  if (/^meet\s+/i.test(text)) return true;
  const agent = cleanText(agentName);
  if (agent && text.toLowerCase().includes(agent.toLowerCase())) return true;
  return /your\s+local\s+real\s+estate\s+guide|real\s+estate\s+guide|connect\s+with\s+/i.test(text);
}

export function looksLikePersonalSubheadline(value: unknown) {
  const text = cleanText(value);
  if (!text) return false;
  return /buying,\s*selling|home value questions|next-step real estate guidance|connect with/i.test(text);
}

export function getLandingPageIntent(input: IntentInput): LandingPageIntent {
  const explicit = normalizeKind(input.pageKind || input.content?.pageKind || input.customContent?.pageKind);
  if (explicit) return INTENTS[explicit];

  const listing = input.listing || {};
  if (cleanText(listing.addressLine1 || listing.address || listing.id)) return INTENTS.listing;

  const sections = input.sections || input.customContent?.sections || input.content?.sections || {};
  if (sections.homeValuation === true) return INTENTS.seller;

  const text = [
    input.title,
    input.description,
    input.customContent?.headline,
    input.content?.headline,
    input.customContent?.subheadline,
    input.content?.subheadline,
  ].map(cleanText).join(' ');

  if (/home\s*value|valuation|worth|sell\s*for|seller|list\s+your/i.test(text)) return INTENTS.seller;
  if (/buyer|home\s*search|search\s*goals|buying\s+plan|game\s*plan/i.test(text)) return INTENTS.buyer;
  if (looksLikePersonalHeadline(input.customContent?.headline || input.content?.headline || input.title)) return INTENTS['agent-profile'];

  return INTENTS.marketing;
}

export function getLandingPageIntentByKind(kind: LandingPageKind) {
  return INTENTS[kind] || INTENTS.marketing;
}
