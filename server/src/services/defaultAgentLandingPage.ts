import { LandingPage } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

export const DEFAULT_AGENT_PROFILE_PAGE_KIND = 'AGENT_PROFILE_DEFAULT';

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || 'agent';
}

export function getPublicAppBaseUrl(req?: RequestLike) {
  const configured = cleanText(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL);
  if (configured) return configured.replace(/\/+$/, '');

  const host = req?.get?.('host');
  if (host) return `${req?.protocol || 'https'}://${host}`.replace(/\/+$/, '');

  return 'https://app.agenteasepro.com';
}

export function buildPublicSiteUrl(slug: string, req?: RequestLike) {
  return `${getPublicAppBaseUrl(req)}/sites/${encodeURIComponent(slug)}`;
}

export function buildLandingPageQrToken() {
  return `lp${randomUUID().replace(/-/g, '')}`.slice(0, 18);
}

function isDefaultAgentProfilePage(page: Pick<LandingPage, 'customContent'>) {
  return asRecord(page.customContent).pageKind === DEFAULT_AGENT_PROFILE_PAGE_KIND;
}

export async function findDefaultAgentLandingPage(agentId: string) {
  const pages = await prisma.landingPage.findMany({
    where: { agentId, listingId: null },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return pages.find(isDefaultAgentProfilePage) || null;
}

async function buildUniqueAgentProfileSlug(agentId: string, nameOrEmail: string) {
  const seed = `${slugify(nameOrEmail)}-${agentId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || randomUUID().slice(0, 6)}`;
  const base = `agent-${seed}`.slice(0, 56).replace(/-+$/g, '');

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 60);
    const existing = await prisma.landingPage.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }

  return `agent-${seed}-${Date.now().toString(36)}`.slice(0, 60);
}

function buildDefaultProfileContent(agent: any, settings: any) {
  const displayName = cleanText([settings?.firstName, settings?.lastName].filter(Boolean).join(' ')) || cleanText(agent.name) || 'Your Agent';
  const firstName = displayName.split(/\s+/)[0] || 'your agent';
  const brokerageName = cleanText(settings?.brokerageName || agent.brokerageName);
  const licenseNumber = cleanText(settings?.licenseNumber || agent.licenseNumber);
  const phone = cleanText(settings?.phone);
  const bio = cleanText(settings?.bio) || `${displayName} helps buyers, sellers, and homeowners move with clarity, local strategy, and fast follow-up.`;

  return {
    pageKind: DEFAULT_AGENT_PROFILE_PAGE_KIND,
    headline: `Meet ${displayName}`,
    subheadline: `A simple way to connect with ${firstName} for buying, selling, home value questions, and next-step real estate guidance.`,
    ctaText: `Connect with ${firstName}`,
    agentDisplayName: displayName,
    agentTitle: 'Real Estate Professional',
    agentEmail: cleanText(agent.email),
    agentPhone: phone,
    agentPhotoUrl: cleanText(settings?.photoUrl),
    agentBio: bio,
    agentWebsiteUrl: cleanText(settings?.websiteUrl),
    agentFacebookUrl: cleanText(settings?.facebookUrl),
    agentInstagramUrl: cleanText(settings?.instagramUrl),
    agentLinkedinUrl: cleanText(settings?.linkedinUrl),
    brokerageDisplayName: brokerageName,
    brokerageLogoUrl: cleanText(settings?.brokerageLogoUrl || settings?.logoUrl),
    brokerageAddress: cleanText(settings?.brokerageAddress || settings?.officeAddress),
    brokeragePhone: cleanText(settings?.brokeragePhone),
    features: [
      'Buying and selling guidance tailored to your timeline',
      'Local pricing insight and market strategy',
      'Clear next steps from first conversation to closing',
      'Fast follow-up for listing, valuation, and showing questions',
    ],
    whyChooseBullets: [
      'Personalized plan before you make a move',
      'Clean communication and transaction coordination',
      'Local vendor, lender, and market-resource guidance',
      'Responsive follow-up for every serious question',
    ],
    stats: {
      yearsExperience: settings?.yearsExperience || undefined,
      clientRating: '5.0',
    },
    showHeaderQr: true,
    qrListingToken: buildLandingPageQrToken(),
    qrPersonalUrl: '',
    qrPersonalLabel: 'Agent Info',
    leadCapture: {
      enabled: true,
      formTitle: `Connect with ${displayName}`,
      formSubtitle: 'Share what you are working on and the agent will follow up with a clear next step.',
      requiredFields: ['name', 'email', 'phone', 'message'],
      buttonText: `Send ${firstName} a message`,
      successMessage: `Thanks. ${firstName} will follow up shortly.`,
    },
    sections: {
      gallery: false,
      features: true,
      video: false,
      virtualTour: false,
      floorPlan: false,
      neighborhood: false,
      amenities: false,
      testimonials: false,
      agent: true,
      contact: true,
      openHouse: false,
      mortgage: false,
      homeValuation: true,
    },
    seoSettings: {
      metaTitle: `${displayName} | Real Estate`,
      metaDescription: `${displayName}${brokerageName ? ` with ${brokerageName}` : ''}. Contact for buying, selling, home value, and local real estate guidance.`,
      keywords: ['real estate agent', displayName, brokerageName, licenseNumber].filter(Boolean),
    },
  };
}

function buildDefaultProfileStyles(settings: any) {
  return {
    primaryColor: cleanText(settings?.brandColor) || '#1e40af',
    secondaryColor: cleanText(settings?.accentColor) || '#0ea5e9',
    accentColor: '#f59e0b',
    heroOpacity: 58,
    heroHeight: 'medium',
    cornerRadius: 'medium',
    animationStyle: 'subtle',
    backgroundPattern: 'grid',
    buttonStyle: 'gradient',
    imageStyle: 'rounded',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
  };
}

export async function ensureDefaultAgentLandingPage(agentId: string) {
  const existing = await findDefaultAgentLandingPage(agentId);
  if (existing) return existing;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { profileSettings: true },
  });

  if (!agent) return null;

  const settings = agent.profileSettings;
  const displayName = cleanText([settings?.firstName, settings?.lastName].filter(Boolean).join(' ')) || cleanText(agent.name) || cleanText(agent.email) || 'Agent';
  const slug = await buildUniqueAgentProfileSlug(agent.id, displayName || agent.email);
  const brokerageName = cleanText(settings?.brokerageName || agent.brokerageName);

  return prisma.landingPage.create({
    data: {
      agentId: agent.id,
      listingId: null,
      slug,
      title: `${displayName} | Real Estate`.slice(0, 120),
      description: `${displayName}${brokerageName ? ` with ${brokerageName}` : ''}. Connect for buying, selling, home value, and local market guidance.`.slice(0, 500),
      templateId: 'modern-luxury',
      isActive: true,
      customContent: buildDefaultProfileContent(agent, settings) as any,
      customStyles: buildDefaultProfileStyles(settings) as any,
    },
  });
}