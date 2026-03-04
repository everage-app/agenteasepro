import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

// Get all landing pages for agent
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const landingPages = await prisma.landingPage.findMany({
      where: {
        agentId: req.user!.id,
      },
      include: {
        listing: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            price: true,
          },
        },
        _count: {
          select: {
            leads: true,
            pageViews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(landingPages);
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    res.status(500).json({ error: 'Failed to fetch landing pages' });
  }
});

// Get landing page by ID or slug
router.get('/:idOrSlug', async (req: AuthenticatedRequest, res) => {
  try {
    const { idOrSlug } = req.params;
    const agentId = req.user!.id;

    const landingPage = await prisma.landingPage.findFirst({
      where: {
        agentId,
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        listing: true,
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        pageViews: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    res.json(landingPage);
  } catch (error) {
    console.error('Error fetching landing page:', error);
    res.status(500).json({ error: 'Failed to fetch landing page' });
  }
});

// Create landing page
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      listingId,
      slug,
      customDomain,
      title,
      description,
      heroImage,
      templateId,
    } = req.body;

    // Check if slug is unique
    const existing = await prisma.landingPage.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Slug already in use' });
    }

    const landingPage = await prisma.landingPage.create({
      data: {
        agentId: req.user!.id,
        listingId,
        slug,
        customDomain,
        title,
        description,
        heroImage,
        templateId: templateId || 'design-67',
      },
    });

    res.status(201).json(landingPage);
  } catch (error) {
    console.error('Error creating landing page:', error);
    res.status(500).json({ error: 'Failed to create landing page' });
  }
});

// Update landing page
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const {
      slug,
      customDomain,
      title,
      description,
      heroImage,
      isActive,
      templateId,
      customContent,
      customStyles,
    } = req.body;

    // If slug is being changed, check uniqueness
    if (slug) {
      const existing = await prisma.landingPage.findFirst({
        where: {
          slug,
          NOT: { id: req.params.id },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Slug already in use' });
      }
    }

    // Build update data, only including defined fields
    const updateData: any = {};
    if (slug !== undefined) updateData.slug = slug;
    if (customDomain !== undefined) updateData.customDomain = customDomain;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (heroImage !== undefined) updateData.heroImage = heroImage;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (customContent !== undefined) updateData.customContent = customContent;
    if (customStyles !== undefined) updateData.customStyles = customStyles;

    const updated = await prisma.landingPage.updateMany({
      where: { id: req.params.id, agentId },
      data: updateData,
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const landingPage = await prisma.landingPage.findFirst({
      where: { id: req.params.id, agentId },
    });

    res.json(landingPage);
  } catch (error) {
    console.error('Error updating landing page:', error);
    res.status(500).json({ error: 'Failed to update landing page' });
  }
});

// Delete landing page
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const deleted = await prisma.landingPage.deleteMany({
      where: { id: req.params.id, agentId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting landing page:', error);
    res.status(500).json({ error: 'Failed to delete landing page' });
  }
});

// Get landing page analytics
router.get('/:id/analytics', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { days = 30 } = req.query;

    const owned = await prisma.landingPage.findFirst({
      where: { id, agentId: req.agentId },
      select: { id: true },
    });

    if (!owned) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const [
      pageViews,
      uniqueVisitors,
      leads,
      conversionRate,
      viewsByDay,
      topSources,
      deviceBreakdown,
      locationData,
    ] = await Promise.all([
      prisma.pageView.count({
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
        },
      }),
      prisma.pageView.findMany({
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
        },
        distinct: ['visitorId'],
      }),
      prisma.lead.count({
        where: {
          agentId: req.agentId,
          landingPageId: id,
          createdAt: { gte: startDate },
        },
      }),
      prisma.landingPage.findUnique({
        where: { id },
        select: { totalViews: true, leadsGenerated: true },
      }),
      prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as views
        FROM "PageView"
        WHERE "landingPageId" = ${id}
          AND "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.pageView.groupBy({
        by: ['utmSource'],
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
          utmSource: { not: null },
        },
        _count: true,
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10,
      }),
      prisma.pageView.groupBy({
        by: ['device'],
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
          device: { not: null },
        },
        _count: true,
      }),
      prisma.pageView.groupBy({
        by: ['city', 'region', 'country'],
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
          country: { not: null },
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10,
      }),
    ]);

    const conversion = conversionRate && conversionRate.totalViews > 0
      ? (conversionRate.leadsGenerated / conversionRate.totalViews) * 100
      : 0;

    res.json({
      summary: {
        pageViews,
        uniqueVisitors: uniqueVisitors.length,
        leads,
        conversionRate: parseFloat(conversion.toFixed(2)),
      },
      viewsByDay,
      topSources,
      deviceBreakdown,
      locationData,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
