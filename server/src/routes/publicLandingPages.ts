import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

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
  },
};

// Get public landing page data (for API consumption)
router.get('/api/sites/:slug', async (req: Request, res: Response) => {
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
        listing: true,
      },
    });

    if (!landingPage || !landingPage.isActive) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    // Get theme config
    const themeId = (landingPage as any).templateId || 'modern-luxury';
    const theme = themes[themeId] || themes['modern-luxury'];
    
    // Parse custom content and styles
    const customContent = (landingPage as any).customContent as any || {};
    const customStyles = (landingPage as any).customStyles as any || {};

    // Build agent info
    const agentSettings = landingPage.agent.profileSettings;
    const agentInfo = {
      name: landingPage.agent.name,
      email: landingPage.agent.email,
      phone: agentSettings?.phone || null,
      photoUrl: agentSettings?.photoUrl || null,
      bio: customContent.agentBio || null,
      licenseNumber: agentSettings?.licenseNumber || landingPage.agent.licenseNumber,
      websiteUrl: agentSettings?.websiteUrl || null,
      facebookUrl: agentSettings?.facebookUrl || null,
      instagramUrl: agentSettings?.instagramUrl || null,
      linkedinUrl: agentSettings?.linkedinUrl || null,
    };

    // Build brokerage info
    const brokerageInfo = {
      name: agentSettings?.brokerageName || landingPage.agent.brokerageName || null,
      logoUrl: (agentSettings as any)?.brokerageLogoUrl || null,
      address: agentSettings?.brokerageAddress || agentSettings?.officeAddress || null,
      phone: agentSettings?.brokeragePhone || null,
      license: (agentSettings as any)?.brokerageLicense || null,
    };

    // Build branding from agent settings or custom styles
    const branding = {
      primaryColor: customStyles.primaryColor || agentSettings?.brandColor || theme.colors.primary,
      secondaryColor: customStyles.secondaryColor || agentSettings?.accentColor || theme.colors.secondary,
      logoUrl: agentSettings?.logoUrl || null,
      heroOpacity: customStyles.heroOpacity || 60,
    };

    // Build listing info if available
    const listingInfo = landingPage.listing ? {
      address: landingPage.listing.addressLine1,
      city: landingPage.listing.city,
      state: landingPage.listing.state,
      zip: landingPage.listing.zipCode,
      price: landingPage.listing.price,
      beds: landingPage.listing.beds,
      baths: landingPage.listing.baths,
      sqft: landingPage.listing.sqft,
      photos: landingPage.listing.primaryImageUrl 
        ? [landingPage.listing.primaryImageUrl] 
        : [],
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
      },
      content: {
        headline: customContent.headline || listingInfo?.address || landingPage.title,
        subheadline: customContent.subheadline || landingPage.description || '',
        ctaText: customContent.ctaText || 'Schedule a Showing',
        features: customContent.features || [],
      },
      branding,
      agent: agentInfo,
      brokerage: brokerageInfo,
      listing: listingInfo,
      heroImage: landingPage.heroImage || listingInfo?.photos?.[0] || null,
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
router.post('/api/sites/:slug/lead', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { firstName, lastName, email, phone, message, source } = req.body;

    if (!firstName || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { slug },
      select: { id: true, agentId: true, listingId: true },
    });

    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        agentId: landingPage.agentId,
        landingPageId: landingPage.id,
        listingId: landingPage.listingId,
        firstName,
        lastName: lastName || '',
        email,
        phone,
        notes: message,
        source: 'WEBSITE',
      },
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
    const visitorId = req.cookies?.visitor_id || generateVisitorId();
    
    await prisma.pageView.create({
      data: {
        landingPageId,
        visitorId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        referrer: req.get('referer'),
        utmSource: req.query.utm_source as string,
        utmMedium: req.query.utm_medium as string,
        utmCampaign: req.query.utm_campaign as string,
      },
    });

    // Update total views
    await prisma.landingPage.update({
      where: { id: landingPageId },
      data: { totalViews: { increment: 1 } },
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

function generateVisitorId(): string {
  return 'v_' + Math.random().toString(36).substring(2, 15);
}

export default router;
