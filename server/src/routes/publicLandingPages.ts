import { Router, Request, Response } from 'express';
import { LeadPriority } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { runLeadCaptureWorkflow } from '../services/leadCaptureWorkflow';

const router = Router();

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

    // Build agent info
    const agentSettings = landingPage.agent.profileSettings;
    const agentInfo = {
      name: customContent.agentDisplayName || landingPage.agent.name,
      title: customContent.agentTitle || null,
      email: customContent.agentEmail || landingPage.agent.email,
      phone: customContent.agentPhone || agentSettings?.phone || null,
      photoUrl: customContent.agentPhotoUrl || agentSettings?.photoUrl || null,
      bio: customContent.agentBio || agentSettings?.bio || null,
      licenseNumber: agentSettings?.licenseNumber || landingPage.agent.licenseNumber,
      websiteUrl: customContent.agentWebsiteUrl || agentSettings?.websiteUrl || null,
      facebookUrl: customContent.agentFacebookUrl || agentSettings?.facebookUrl || null,
      instagramUrl: customContent.agentInstagramUrl || agentSettings?.instagramUrl || null,
      linkedinUrl: customContent.agentLinkedinUrl || agentSettings?.linkedinUrl || null,
    };

    // Build brokerage info
    const brokerageInfo = {
      name: customContent.brokerageDisplayName || agentSettings?.brokerageName || landingPage.agent.brokerageName || null,
      logoUrl: customContent.brokerageLogoUrl || (agentSettings as any)?.brokerageLogoUrl || null,
      logoWidth: (agentSettings as any)?.brokerageLogoWidth || 260,
      logoBackground: (agentSettings as any)?.brokerageLogoBackground === 'TRANSPARENT' ? 'TRANSPARENT' : 'CARD',
      address: customContent.brokerageAddress || agentSettings?.brokerageAddress || agentSettings?.officeAddress || null,
      phone: customContent.brokeragePhone || agentSettings?.brokeragePhone || null,
      license: (agentSettings as any)?.brokerageLicense || null,
    };

    // Build branding from agent settings or custom styles
    const branding = {
      primaryColor: customStyles.primaryColor || agentSettings?.brandColor || theme.colors.primary,
      secondaryColor: customStyles.secondaryColor || agentSettings?.accentColor || theme.colors.secondary,
      logoUrl: customContent.brokerageLogoUrl || agentSettings?.brokerageLogoUrl || agentSettings?.logoUrl || null,
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
router.post('/:slug/lead', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { firstName, lastName, email, phone, message, source, qrToken, qrUrl } = req.body;

    if (!firstName || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { slug },
      select: { id: true, agentId: true, listingId: true, title: true },
    });

    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingLead = normalizedEmail
      ? await prisma.lead.findFirst({
          where: { agentId: landingPage.agentId, email: normalizedEmail },
        })
      : null;

    const notes = String(message || '').trim();
    const normalizedQrToken = String(qrToken || '').trim().slice(0, 64);
    const normalizedQrUrl = String(qrUrl || '').trim().slice(0, 2048);
    const followUpTask = `Follow up on ${landingPage.title || 'landing page'} inquiry today`;
    const landingTags = [`SOURCE:landing page`, `LP:${slug}`, ...(normalizedQrToken ? [`QR:${normalizedQrToken}`] : [])];
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            firstName: existingLead.firstName || firstName,
            lastName: existingLead.lastName || lastName || '',
            phone: existingLead.phone || phone || null,
            source: 'LANDING_PAGE',
            landingPageId: landingPage.id,
            listingId: landingPage.listingId,
            priority: existingLead.priority === LeadPriority.HOT ? LeadPriority.HOT : LeadPriority.WARM,
            tags: Array.from(new Set([...(existingLead.tags || []), ...landingTags])),
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
            firstName,
            lastName: lastName || '',
            email: normalizedEmail,
            phone,
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
        activityType: 'LANDING_PAGE_CAPTURE',
        description: `Lead captured from ${landingPage.title || `public landing page ${slug}`}`,
        metadata: {
          slug,
          landingPageTitle: landingPage.title,
          source: source || 'landing-page-form',
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
      sourceLabel: 'landing page',
      message: notes || null,
      contextPath: `/api/sites/${slug}/lead`,
      listingId: landingPage.listingId,
      landingPageId: landingPage.id,
      createTask: true,
      taskDescription: `New lead from landing page /sites/${slug}. Reach out while interest is fresh.`,
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
