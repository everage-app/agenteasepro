import { Router, Request, Response } from 'express';
import { LeadPriority } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { runLeadCaptureWorkflow } from '../services/leadCaptureWorkflow';
import { buildPublicSiteUrl, ensureDefaultAgentLandingPage } from '../services/defaultAgentLandingPage';

const router = Router();

const publicLeadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many landing page requests. Please try again shortly.' },
});

// Theme definitions (matching frontend)
const themes: Record<string, {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    heroOverlay: string;
  };
  fonts: { heading: string; body: string };
  layout: 'modern' | 'classic' | 'minimal' | 'bold' | 'elegant';
}> = {
  'modern-luxury': {
    colors: {
      primary: '#1e40af',
      secondary: '#0ea5e9',
      accent: '#f59e0b',
      background: '#0f172a',
      text: '#f1f5f9',
      heroOverlay: 'rgba(15, 23, 42, 0.6)',
    },
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    layout: 'modern',
  },
  'warm-earth': {
    colors: {
      primary: '#92400e',
      secondary: '#d97706',
      accent: '#065f46',
      background: '#fef3c7',
      text: '#1c1917',
      heroOverlay: 'rgba(120, 53, 15, 0.5)',
    },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
    layout: 'classic',
  },
  'minimal-white': {
    colors: {
      primary: '#18181b',
      secondary: '#71717a',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#18181b',
      heroOverlay: 'rgba(255, 255, 255, 0.2)',
    },
    fonts: { heading: 'DM Sans', body: 'DM Sans' },
    layout: 'minimal',
  },
  'bold-contrast': {
    colors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#10b981',
      background: '#030712',
      text: '#f9fafb',
      heroOverlay: 'rgba(124, 58, 237, 0.4)',
    },
    fonts: { heading: 'Poppins', body: 'Poppins' },
    layout: 'bold',
  },
  'elegant-serif': {
    colors: {
      primary: '#1e3a5f',
      secondary: '#c9a227',
      accent: '#8b5a2b',
      background: '#f8f5f0',
      text: '#1e3a5f',
      heroOverlay: 'rgba(30, 58, 95, 0.5)',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    layout: 'elegant',
  },
  'coastal-breeze': {
    colors: {
      primary: '#0369a1',
      secondary: '#06b6d4',
      accent: '#fbbf24',
      background: '#f0f9ff',
      text: '#0c4a6e',
      heroOverlay: 'rgba(3, 105, 161, 0.4)',
    },
    fonts: { heading: 'Montserrat', body: 'Open Sans' },
    layout: 'minimal',
  },
  'urban-edge': {
    colors: {
      primary: '#374151',
      secondary: '#f97316',
      accent: '#22c55e',
      background: '#111827',
      text: '#e5e7eb',
      heroOverlay: 'rgba(17, 24, 39, 0.7)',
    },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    layout: 'bold',
  },
  'garden-retreat': {
    colors: {
      primary: '#166534',
      secondary: '#84cc16',
      accent: '#a16207',
      background: '#f0fdf4',
      text: '#14532d',
      heroOverlay: 'rgba(22, 101, 52, 0.4)',
    },
    fonts: { heading: 'Quicksand', body: 'Nunito' },
    layout: 'classic',
  },
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function detectDevice(userAgent?: string | null) {
  const value = String(userAgent || '').toLowerCase();
  if (!value) return null;
  if (/ipad|tablet/.test(value)) return 'TABLET';
  if (/iphone|android.+mobile|mobile/.test(value)) return 'MOBILE';
  return 'DESKTOP';
}

function detectBrowser(userAgent?: string | null) {
  const value = String(userAgent || '').toLowerCase();
  if (!value) return null;
  if (value.includes('edg/')) return 'Edge';
  if (value.includes('chrome/')) return 'Chrome';
  if (value.includes('safari/') && !value.includes('chrome/')) return 'Safari';
  if (value.includes('firefox/')) return 'Firefox';
  return 'Other';
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isUnsupportedPublicImageUrl(value: string) {
  return /^data:image\/hei[cf]/i.test(value) || /\.hei[cf](?:$|[?#])/i.test(value);
}

function cleanRenderableImageUrl(preferred: unknown, fallback?: unknown) {
  const preferredUrl = cleanText(preferred);
  if (preferredUrl && !isUnsupportedPublicImageUrl(preferredUrl)) return preferredUrl;

  const fallbackUrl = cleanText(fallback);
  if (fallbackUrl && !isUnsupportedPublicImageUrl(fallbackUrl)) return fallbackUrl;

  return null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: unknown) {
  const raw = cleanText(value);
  const digits = raw.replace(/\D/g, '');
  return { raw, digits };
}

function extractPhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return typeof record.url === 'string'
          ? record.url
          : typeof record.href === 'string'
            ? record.href
            : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function extractConfig(landingPage: any) {
  const customContent = asRecord(landingPage?.customContent);
  const customStyles = asRecord(landingPage?.customStyles);

  return {
    customContent,
    customStyles,
    seoSettings: asRecord(customContent.seoSettings),
    leadCapture: asRecord(customContent.leadCapture),
    sections: asRecord(customContent.sections),
  };
}

// Get public landing page data (for API consumption)
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const landingPage = await prisma.landingPage.findUnique({
      where: { slug },
      include: {
        agent: {
          include: {
            profileSettings: true,
          },
        },
        listing: {
          include: {
            mlsImports: {
              orderBy: { lastFetchedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!landingPage || !landingPage.isActive) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    // Fetch agent's other active landing pages (for the "other listings" carousel)
    const otherPages = await prisma.landingPage.findMany({
      where: {
        agentId: landingPage.agentId,
        isActive: true,
        id: { not: landingPage.id },
      },
      include: {
        listing: {
          include: {
            mlsImports: { orderBy: { lastFetchedAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    });
    const otherListings = otherPages.map((p) => {
      const mlsPhotos = extractPhotoUrls(p.listing?.mlsImports?.[0]?.photos);
      const pc = asRecord(p.customContent);
      const gallery = extractPhotoUrls(pc.galleryImages);
      const photo = p.heroImage || gallery[0] || p.listing?.heroImageUrl || p.listing?.primaryImageUrl || mlsPhotos[0] || null;
      return {
        slug: p.slug,
        title: pc.headline || p.title || p.listing?.addressLine1 || 'View Listing',
        address: p.listing?.addressLine1 || null,
        city: p.listing?.city || null,
        state: p.listing?.state || null,
        price: p.listing?.price ? Number(p.listing.price) : null,
        beds: p.listing?.beds || null,
        baths: p.listing?.baths || null,
        sqft: p.listing?.sqft || null,
        photo,
      };
    });

    // Get theme config
    const themeId = (landingPage as any).templateId || 'modern-luxury';
    const theme = themes[themeId] || themes['modern-luxury'];
    
    // Parse custom content and styles
    const { customContent, customStyles, seoSettings, leadCapture, sections } = extractConfig(landingPage);
    const pageKind = cleanText(customContent.pageKind || (landingPage.listingId ? 'LISTING' : ''));

    let defaultAgentPage = null;
    try {
      defaultAgentPage = await ensureDefaultAgentLandingPage(landingPage.agentId);
    } catch (defaultPageError) {
      console.error('Error ensuring default agent profile page:', defaultPageError);
    }

    const publicUrl = buildPublicSiteUrl(landingPage.slug, req);
    const defaultAgentProfileUrl = defaultAgentPage?.slug ? buildPublicSiteUrl(defaultAgentPage.slug, req) : null;

    // Build agent info
    const agentSettings = landingPage.agent.profileSettings;
    const profileDisplayName = cleanText([
      agentSettings?.firstName,
      agentSettings?.lastName,
    ].filter(Boolean).join(' '));
    const customAgentDisplayName = cleanText(customContent.agentDisplayName);
    const storedAgentName = cleanText(landingPage.agent.name);
    const customNameLooksComplete = customAgentDisplayName.split(/\s+/).filter(Boolean).length > 1;
    const agentDisplayName = customNameLooksComplete
      ? customAgentDisplayName
      : profileDisplayName || customAgentDisplayName || storedAgentName;
    const agentInfo = {
      name: agentDisplayName || landingPage.agent.name,
      title: cleanText(customContent.agentTitle) || null,
      email: cleanText(customContent.agentEmail) || cleanText(landingPage.agent.email),
      phone: cleanText(customContent.agentPhone) || cleanText(agentSettings?.phone) || null,
      photoUrl: cleanRenderableImageUrl(customContent.agentPhotoUrl, agentSettings?.photoUrl),
      bio: cleanText(customContent.agentBio) || cleanText(agentSettings?.bio) || null,
      licenseNumber: agentSettings?.licenseNumber || landingPage.agent.licenseNumber,
      websiteUrl: cleanText(customContent.agentWebsiteUrl) || cleanText(agentSettings?.websiteUrl) || null,
      profileUrl: cleanText(customContent.agentProfileUrl) || defaultAgentProfileUrl,
      facebookUrl: cleanText(customContent.agentFacebookUrl) || cleanText(agentSettings?.facebookUrl) || null,
      instagramUrl: cleanText(customContent.agentInstagramUrl) || cleanText(agentSettings?.instagramUrl) || null,
      linkedinUrl: cleanText(customContent.agentLinkedinUrl) || cleanText(agentSettings?.linkedinUrl) || null,
    };

    // Build brokerage info
    const brokerageInfo = {
      name: cleanText(customContent.brokerageDisplayName) || cleanText(agentSettings?.brokerageName) || cleanText(landingPage.agent.brokerageName) || null,
      logoUrl: cleanRenderableImageUrl(customContent.brokerageLogoUrl, (agentSettings as any)?.brokerageLogoUrl),
      logoWidth: (agentSettings as any)?.brokerageLogoWidth || 260,
      logoBackground: (agentSettings as any)?.brokerageLogoBackground === 'TRANSPARENT' ? 'TRANSPARENT' : 'CARD',
      address: cleanText(customContent.brokerageAddress) || cleanText(agentSettings?.brokerageAddress) || cleanText(agentSettings?.officeAddress) || null,
      phone: cleanText(customContent.brokeragePhone) || cleanText(agentSettings?.brokeragePhone) || null,
      license: (agentSettings as any)?.brokerageLicense || null,
    };

    // Build branding from agent settings or custom styles
    const branding = {
      primaryColor: cleanText(customStyles.primaryColor) || cleanText(agentSettings?.brandColor) || theme.colors.primary,
      secondaryColor: cleanText(customStyles.secondaryColor) || cleanText(agentSettings?.accentColor) || theme.colors.secondary,
      logoUrl: cleanRenderableImageUrl(customContent.brokerageLogoUrl, agentSettings?.brokerageLogoUrl || agentSettings?.logoUrl),
      heroOpacity: customStyles.heroOpacity || 60,
    };

    // Build listing info if available
    const mlsPhotos = extractPhotoUrls(landingPage.listing?.mlsImports?.[0]?.photos);
    const galleryImages = extractPhotoUrls(customContent.galleryImages);
    const listingPhotoCandidates = [
      ...galleryImages,
      landingPage.listing?.heroImageUrl,
      landingPage.listing?.primaryImageUrl,
      ...mlsPhotos,
    ].filter(Boolean) as string[];
    const listingPhotos = Array.from(new Set(listingPhotoCandidates));

    const listingInfo = landingPage.listing ? {
      address: landingPage.listing.addressLine1,
      city: landingPage.listing.city,
      state: landingPage.listing.state,
      zip: landingPage.listing.zipCode,
      price: landingPage.listing.price,
      beds: landingPage.listing.beds,
      baths: landingPage.listing.baths,
      sqft: landingPage.listing.sqft,
      headline: landingPage.listing.headline,
      photos: listingPhotos,
      description: landingPage.listing.description,
      mlsNumber: landingPage.listing.mlsId,
    } : null;

    // Build response
    const response = {
      id: landingPage.id,
      title: landingPage.title,
      description: landingPage.description,
      slug: landingPage.slug,
      pageKind: pageKind || null,
      publicUrl,
      theme: {
        id: themeId,
        ...theme,
        fonts: {
          heading: customStyles.headingFont || theme.fonts.heading,
          body: customStyles.bodyFont || theme.fonts.body,
        },
      },
      customStyles: {
        heroHeight: customStyles.heroHeight || 'large',
        cornerRadius: customStyles.cornerRadius || 'medium',
        animationStyle: customStyles.animationStyle || 'subtle',
        backgroundPattern: customStyles.backgroundPattern || 'none',
        buttonStyle: customStyles.buttonStyle || 'gradient',
        imageStyle: customStyles.imageStyle || 'rounded',
        headingFont: customStyles.headingFont || theme.fonts.heading,
        bodyFont: customStyles.bodyFont || theme.fonts.body,
      },
      content: {
        pageKind: pageKind || null,
        headline: customContent.headline || listingInfo?.headline || landingPage.title || listingInfo?.address,
        subheadline: customContent.subheadline || landingPage.description || '',
        ctaText: customContent.ctaText || 'Schedule a Showing',
        features: customContent.features || [],
        urgencyText: customContent.urgencyText || '',
        socialProofText: customContent.socialProofText || '',
        galleryImages,
        neighborhoodDescription: customContent.neighborhoodDescription || '',
        nearbyAmenities: customContent.nearbyAmenities || [],
        testimonials: customContent.testimonials || [],
        openHouses: customContent.openHouses || [],
        videoUrl: customContent.videoUrl || null,
        virtualTourUrl: customContent.virtualTourUrl || null,
        floorPlanUrl: customContent.floorPlanUrl || null,
        whyChooseBullets: customContent.whyChooseBullets || [],
        stats: customContent.stats || null,
        showHeaderQr: Boolean(customContent.showHeaderQr),
        qrListingUrl: customContent.qrListingUrl || '',
        qrListingToken: customContent.qrListingToken || '',
        qrPersonalUrl: customContent.qrPersonalUrl || '',
        qrPersonalLabel: customContent.qrPersonalLabel || 'Agent info',
      },
      branding,
      agent: agentInfo,
      brokerage: brokerageInfo,
      listing: listingInfo,
      heroImage: landingPage.heroImage || galleryImages[0] || landingPage.listing?.heroImageUrl || listingInfo?.photos?.[0] || null,
      sections,
      leadCapture,
      forceCapture: asRecord(customContent.forceCapture),
      seoSettings,
      otherListings,
      analytics: {
        totalViews: landingPage.totalViews,
        uniqueViews: landingPage.uniqueViews,
        leadsGenerated: landingPage.leadsGenerated,
        conversionRate: landingPage.totalViews > 0 ? Number(((landingPage.leadsGenerated / landingPage.totalViews) * 100).toFixed(2)) : 0,
      },
    };

    // Track page view
    await trackPageView(landingPage.id, req);

    res.json(response);
  } catch (error) {
    console.error('Error fetching public landing page:', error);
    res.status(500).json({ error: 'Failed to load landing page' });
  }
});

// Submit lead from landing page
router.post('/:slug/lead', publicLeadLimiter, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { firstName, lastName, email, phone, message, source, qrToken, qrUrl, contactIntent, propertyAddress, website, company } = req.body;

    if (cleanText(website) || cleanText(company)) {
      return res.status(201).json({ success: true, leadId: null });
    }

    if (!cleanText(firstName) || !cleanText(email)) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { slug },
      select: { id: true, agentId: true, listingId: true, title: true, customContent: true },
    });

    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const customContent = asRecord(landingPage.customContent);
    const leadCapture = asRecord(customContent.leadCapture);
    const sections = asRecord(customContent.sections);
    const requiredFields = Array.isArray(leadCapture.requiredFields)
      ? leadCapture.requiredFields.map(cleanText).filter(Boolean)
      : ['name', 'email', 'phone'];
    const sourceValue = cleanText(source);
    const isEmailQuestion = sourceValue === 'LANDING_PAGE_EMAIL' || cleanText(contactIntent) === 'EMAIL_QUESTION';
    const isHomeValuation = sourceValue === 'LANDING_PAGE_VALUATION' || sections.homeValuation === true;
    const normalizedEmail = cleanText(email).toLowerCase();
    const normalizedFirstName = cleanText(firstName);
    const normalizedLastName = cleanText(lastName);
    const normalizedPhone = normalizePhone(phone);
    const normalizedPropertyAddress = cleanText(propertyAddress);
    const notes = cleanText(message);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    if (!isEmailQuestion && requiredFields.includes('phone') && !normalizedPhone.raw) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (normalizedPhone.raw && normalizedPhone.digits.length < 10) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }

    if (!isEmailQuestion && requiredFields.includes('message') && !notes) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (isHomeValuation && sourceValue === 'LANDING_PAGE_VALUATION' && !normalizedPropertyAddress) {
      return res.status(400).json({ error: 'Property address is required for a home value report' });
    }

    const existingLead = normalizedEmail
      ? await prisma.lead.findFirst({
          where: { agentId: landingPage.agentId, email: normalizedEmail },
        })
      : null;

    const sourceLabel = isEmailQuestion ? 'landing page email question' : 'landing page';
    const normalizedQrToken = cleanText(qrToken).slice(0, 64);
    const normalizedQrUrl = cleanText(qrUrl).slice(0, 2048);
    const followUpTask = `Follow up on ${landingPage.title || 'landing page'} inquiry today`;
    const landingTags = [
      `SOURCE:landing page`,
      `LP:${slug}`,
      ...(isHomeValuation ? ['INTENT:home-value'] : []),
      ...(isEmailQuestion ? ['INTENT:question'] : []),
      ...(normalizedQrToken ? [`QR:${normalizedQrToken}`] : []),
    ];
    const existingLeadTags = existingLead?.tags || [];
    const resurfacedTags = existingLeadTags.filter((tag) => tag !== 'ARCHIVED');
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            firstName: existingLead.firstName || normalizedFirstName,
            lastName: existingLead.lastName || normalizedLastName || '',
            phone: existingLead.phone || normalizedPhone.raw || null,
            mailingAddress: existingLead.mailingAddress || normalizedPropertyAddress || undefined,
            source: 'LANDING_PAGE',
            landingPageId: landingPage.id,
            listingId: landingPage.listingId,
            priority: existingLead.priority === LeadPriority.HOT ? LeadPriority.HOT : LeadPriority.WARM,
            tags: Array.from(new Set([...resurfacedTags, ...landingTags])),
            deletedAt: null,
            nextTask: existingLead.nextTask || followUpTask,
            visitCount: { increment: 1 },
            lastVisit: new Date(),
            notes: notes
              ? existingLead.notes
                ? `${existingLead.notes}\n\n[Landing Page Inquiry] ${notes}`
                : notes
              : existingLead.notes,
            lastContact: new Date(),
          },
        })
      : await prisma.lead.create({
          data: {
            agentId: landingPage.agentId,
            landingPageId: landingPage.id,
            listingId: landingPage.listingId,
            firstName: normalizedFirstName,
            lastName: normalizedLastName || '',
            email: normalizedEmail,
            phone: normalizedPhone.raw || null,
            mailingAddress: normalizedPropertyAddress || undefined,
            notes: notes || undefined,
            source: 'LANDING_PAGE',
            priority: LeadPriority.WARM,
            tags: landingTags,
            nextTask: followUpTask,
            visitCount: 1,
            lastVisit: new Date(),
            lastContact: new Date(),
          },
        });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        listingId: landingPage.listingId || undefined,
        activityType: isEmailQuestion ? 'LANDING_PAGE_EMAIL_QUESTION' : 'LANDING_PAGE_CAPTURE',
        description: isEmailQuestion
          ? `Question sent from ${landingPage.title || `public landing page ${slug}`}`
          : `Lead captured from ${landingPage.title || `public landing page ${slug}`}`,
        metadata: {
          slug,
          landingPageTitle: landingPage.title,
          source: sourceValue || 'landing-page-form',
          contactIntent: isEmailQuestion ? 'EMAIL_QUESTION' : null,
          qrToken: normalizedQrToken || null,
          qrUrl: normalizedQrUrl || null,
          message: notes || null,
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
          referrer: req.get('referer') || null,
        },
      },
    });

    await runLeadCaptureWorkflow({
      agentId: landingPage.agentId,
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
      },
      sourceLabel,
      message: notes || null,
      contextPath: `/api/sites/${slug}/lead`,
      listingId: landingPage.listingId,
      landingPageId: landingPage.id,
      createTask: true,
      taskDescription: isEmailQuestion
        ? `Reply to this landing page question while the visitor is warm: ${notes || `/sites/${slug}`}`
        : `New lead from landing page /sites/${slug}. Reach out while interest is fresh.`,
    });

    // Update landing page lead count
    await prisma.landingPage.update({
      where: { id: landingPage.id },
      data: { leadsGenerated: { increment: 1 } },
    });

    res.status(201).json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// Track page view
async function trackPageView(landingPageId: string, req: Request) {
  try {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const userAgent = req.get('user-agent') || undefined;
    const acceptLanguage = req.get('accept-language') || '';
    const ipAddress = forwardedFor || req.ip || req.socket.remoteAddress || undefined;
    const visitorId = [landingPageId, ipAddress || 'anon', userAgent || 'ua', acceptLanguage].join('|').slice(0, 255);

    const existingView = await prisma.pageView.findFirst({
      where: {
        landingPageId,
        visitorId,
      },
      select: { id: true },
    });
    
    await prisma.pageView.create({
      data: {
        landingPageId,
        visitorId,
        ipAddress,
        userAgent,
        referrer: req.get('referer'),
        utmSource: req.query.utm_source as string,
        utmMedium: req.query.utm_medium as string,
        utmCampaign: req.query.utm_campaign as string,
        utmContent: (req.query.utm_content || req.query.lpqr) as string,
        utmTerm: req.query.utm_term as string,
        device: detectDevice(userAgent),
        browser: detectBrowser(userAgent),
      },
    });

    // Update total views
    await prisma.landingPage.update({
      where: { id: landingPageId },
      data: {
        totalViews: { increment: 1 },
        ...(existingView ? {} : { uniqueViews: { increment: 1 } }),
      },
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

function generateVisitorId(): string {
  return 'v_' + Math.random().toString(36).substring(2, 15);
}

export default router;
