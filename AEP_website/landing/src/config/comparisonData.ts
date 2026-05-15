export type ProductId =
  | 'agenteasepro'
  | 'followupboss'
  | 'proagentwebsites'
  | 'boomtown'
  | 'boldtrail';

export type ComparisonTone = 'included' | 'limited' | 'missing' | 'quote';

export interface ComparisonStatus {
  label: string;
  tone: ComparisonTone;
}

export interface ComparisonProduct {
  id: ProductId;
  name: string;
  price: string;
  priceNote: string;
  positioning: string;
  summary: string;
  watchout: string;
}

export interface ComparisonRow {
  label: string;
  values: Record<ProductId, ComparisonStatus>;
}

export const comparisonProducts: ComparisonProduct[] = [
  {
    id: 'agenteasepro',
    name: 'AgentEasePro',
    price: '$49.99/mo',
    priceNote: 'No per-user math and no required add-ons for the core agent workflow.',
    positioning: 'Utah-ready all-in-one workspace',
    summary:
      'Combines Utah contracts, e-signatures, deadline tracking, CRM, listing workflows, marketing, and compliance in one place.',
    watchout: 'Best fit when you want the full daily workflow, not another partial tool that still needs backup software.',
  },
  {
    id: 'followupboss',
    name: 'Follow Up Boss',
    price: 'From $58/user/mo',
    priceNote: 'Grow starts at $58/user/mo billed annually. Calling on Grow is a $33/user add-on.',
    positioning: 'CRM and lead follow-up',
    summary:
      'Excellent for routing, texting, calling, and automating internet lead response when you already have the rest of the stack.',
    watchout:
      'Their own FAQ says they are not a website company or transaction platform, so the public starting price is not a full operating system.',
  },
  {
    id: 'proagentwebsites',
    name: 'ProAgentWebsites',
    price: 'From $49.95/mo',
    priceNote: 'Single Agent Lite at $49.95/mo is website only. CRM starts at $79.95/mo on Single Agent Full.',
    positioning: 'Website, IDX, and CRM platform',
    summary:
      'Strong IDX website, lead capture, CRM, SMS drip, and AI page creation for agents who want a lead-gen site.',
    watchout:
      'Base pricing still leaves out Utah REPC workflow, built-in e-signatures, and transaction-close automation.',
  },
  {
    id: 'boomtown',
    name: 'BoomTown',
    price: 'Custom demo / quote',
    priceNote: 'Public package comparison exists, but pricing is demo-led and depends on package scope and users.',
    positioning: 'Enterprise IDX + CRM growth suite',
    summary:
      'Combines IDX websites, CRM, lead generation, and concierge-style services for teams and brokerages.',
    watchout:
      'Package-led sale, no public self-serve monthly price, and no Utah-specific contract workflow in the public positioning.',
  },
  {
    id: 'boldtrail',
    name: 'BoldTrail',
    price: 'Custom demo / quiz',
    priceNote: 'Configured packages, quiz-led selection, and add-on ecosystem. No public self-serve monthly price.',
    positioning: 'AI CRM, IDX, marketing, and back-office ecosystem',
    summary:
      'Pitches configurable IDX websites, AI CRM, marketing, analytics, marketplace, and back-office modules.',
    watchout:
      'Broad ecosystem, but not a clean Utah-ready all-in-one offer at a simple public monthly price.',
  },
];

export const homepageProductIds: ProductId[] = [
  'agenteasepro',
  'followupboss',
  'proagentwebsites',
];

export const enterpriseProductIds: ProductId[] = ['boomtown', 'boldtrail'];

export const fullComparisonProductIds: ProductId[] = [
  'agenteasepro',
  'followupboss',
  'proagentwebsites',
  'boomtown',
  'boldtrail',
];

export const commonStack = {
  total: '$137.95/mo',
  savings: '$87.96/mo',
  savingsPercent: '64%',
  headline: 'Typical starting point for CRM + website basics',
  subheadline:
    'That still leaves contracts, built-in e-signatures, Utah REPC workflow, deadline automation, and compliance outside the package.',
  tools: [
    {
      name: 'Follow Up Boss Grow',
      price: '$58/user/mo',
      note: 'Base CRM plan billed annually. Calling on Grow is +$33/user.',
    },
    {
      name: 'ProAgentWebsites Full',
      price: '$79.95/mo',
      note: 'Website + CRM starting tier. Lite at $49.95/mo is website only.',
    },
  ],
  missingItems: [
    'Utah REPC generation',
    'Built-in e-signatures',
    'Auto-calculated contract deadlines',
    'Transaction compliance workflow',
  ],
};

export const pricingDisclaimer =
  'Public pricing and packaging reviewed on vendor pages in April 2026. Follow Up Boss and ProAgentWebsites numbers shown here are public starting plans; annual billing, add-ons, higher tiers, and quote-led packages can push real totals higher.';

export const agenteaseIncludedFeatures = [
  'Utah REPC generator',
  'Built-in e-signatures',
  'Auto-calculated deadlines',
  'Unlimited clients and deals',
  'Daily task list',
  'SMS and email reminders',
  'Lead CRM',
  'Deal pipeline',
  'Listing management',
  'Marketing campaigns',
  'Compliance vault',
  'Priority support',
];

export const comparisonRows: ComparisonRow[] = [
  {
    label: 'Utah-specific forms and workflow',
    values: {
      agenteasepro: { label: 'Built for Utah', tone: 'included' },
      followupboss: { label: 'Generic CRM', tone: 'missing' },
      proagentwebsites: { label: 'Generic websites', tone: 'missing' },
      boomtown: { label: 'Not Utah-specific', tone: 'missing' },
      boldtrail: { label: 'Not Utah-specific', tone: 'missing' },
    },
  },
  {
    label: 'Contract generation with addenda',
    values: {
      agenteasepro: { label: 'Built in', tone: 'included' },
      followupboss: { label: 'Not included', tone: 'missing' },
      proagentwebsites: { label: 'Not included', tone: 'missing' },
      boomtown: { label: 'Not public', tone: 'missing' },
      boldtrail: { label: 'Separate modules', tone: 'limited' },
    },
  },
  {
    label: 'Auto-calculated contract deadlines',
    values: {
      agenteasepro: { label: 'Built in', tone: 'included' },
      followupboss: { label: 'Action plans only', tone: 'limited' },
      proagentwebsites: { label: 'Not included', tone: 'missing' },
      boomtown: { label: 'Not public', tone: 'missing' },
      boldtrail: { label: 'Back-office add-on', tone: 'limited' },
    },
  },
  {
    label: 'Built-in e-signatures',
    values: {
      agenteasepro: { label: 'Included', tone: 'included' },
      followupboss: { label: 'Not included', tone: 'missing' },
      proagentwebsites: { label: 'Not included', tone: 'missing' },
      boomtown: { label: 'Not public', tone: 'missing' },
      boldtrail: { label: 'Not public', tone: 'missing' },
    },
  },
  {
    label: 'CRM and lead follow-up',
    values: {
      agenteasepro: { label: 'Included', tone: 'included' },
      followupboss: { label: 'Core strength', tone: 'included' },
      proagentwebsites: { label: 'On Full plan', tone: 'included' },
      boomtown: { label: 'Included', tone: 'included' },
      boldtrail: { label: 'Included', tone: 'included' },
    },
  },
  {
    label: 'Website / IDX lead capture',
    values: {
      agenteasepro: { label: 'MLS sync + listing hub', tone: 'limited' },
      followupboss: { label: 'Bring your own site', tone: 'missing' },
      proagentwebsites: { label: 'Core strength', tone: 'included' },
      boomtown: { label: 'Included', tone: 'included' },
      boldtrail: { label: 'Included', tone: 'included' },
    },
  },
  {
    label: 'Listing marketing and campaigns',
    values: {
      agenteasepro: { label: 'Included', tone: 'included' },
      followupboss: { label: 'Lead follow-up focus', tone: 'limited' },
      proagentwebsites: { label: 'Included', tone: 'included' },
      boomtown: { label: 'Included', tone: 'included' },
      boldtrail: { label: 'Included', tone: 'included' },
    },
  },
  {
    label: 'Transaction compliance and audit trail',
    values: {
      agenteasepro: { label: 'Included', tone: 'included' },
      followupboss: { label: 'Not included', tone: 'missing' },
      proagentwebsites: { label: 'Not included', tone: 'missing' },
      boomtown: { label: 'Not public', tone: 'missing' },
      boldtrail: { label: 'Back-office product', tone: 'limited' },
    },
  },
  {
    label: 'AI assistance included',
    values: {
      agenteasepro: { label: 'Included', tone: 'included' },
      followupboss: { label: 'Included', tone: 'included' },
      proagentwebsites: { label: 'AI pages + ChatGPT', tone: 'included' },
      boomtown: { label: 'Predictive tools', tone: 'limited' },
      boldtrail: { label: 'AI suite', tone: 'included' },
    },
  },
  {
    label: 'One workspace instead of a stack',
    values: {
      agenteasepro: { label: 'Yes', tone: 'included' },
      followupboss: { label: 'CRM only', tone: 'missing' },
      proagentwebsites: { label: 'Website + CRM only', tone: 'limited' },
      boomtown: { label: 'Suite + services', tone: 'limited' },
      boldtrail: { label: 'Configured ecosystem', tone: 'limited' },
    },
  },
  {
    label: 'Public pricing on the website',
    values: {
      agenteasepro: { label: 'Yes', tone: 'included' },
      followupboss: { label: 'Yes', tone: 'included' },
      proagentwebsites: { label: 'Yes', tone: 'included' },
      boomtown: { label: 'Demo required', tone: 'quote' },
      boldtrail: { label: 'Quote / quiz', tone: 'quote' },
    },
  },
  {
    label: 'Base price already covers the core workflow',
    values: {
      agenteasepro: { label: 'Yes', tone: 'included' },
      followupboss: { label: 'No, CRM first', tone: 'missing' },
      proagentwebsites: { label: 'No, website first', tone: 'missing' },
      boomtown: { label: 'Package-based', tone: 'quote' },
      boldtrail: { label: 'Configured + add-ons', tone: 'quote' },
    },
  },
];
