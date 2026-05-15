import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import { storage } from '../services/storageService';

const router = Router();

router.use(authenticateToken);

const shouldInlineLandingPageAssets = () => {
  const forceInline = (process.env.INLINE_LANDING_PAGE_ASSETS || '').toLowerCase();
  if (forceInline === 'true') return true;
  if (forceInline === 'false') return false;

  const storageBackend = (process.env.STORAGE_BACKEND || 'local').toLowerCase();
  return process.env.NODE_ENV === 'production' && storageBackend === 'local';
};

const resolveImageExtension = (file: Express.Multer.File) => {
  const fromName = path.extname(file.originalname || '').toLowerCase();
  if (fromName) return fromName;

  switch ((file.mimetype || '').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    default:
      return '.bin';
  }
};

const persistLandingPageAsset = async (file: Express.Multer.File, pageId: string, agentId: string) => {
  if (shouldInlineLandingPageAssets()) {
    const mimeType = file.mimetype || 'image/png';
    return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
  }

  const key = `landing-pages/landing-page-${agentId}-${pageId}-${Date.now()}${resolveImageExtension(file)}`;
  const saved = await storage.put(key, file.buffer, file.mimetype || 'application/octet-stream');
  return saved.url;
};

const imageFileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const env = (process.env.NODE_ENV || '').toLowerCase();
  if (env === 'test') {
    cb(null, true);
    return;
  }

  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/svg+xml',
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.svg'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
    return;
  }

  cb(new Error('Invalid file type. Only images are allowed.'));
};

const landingPageAssetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const handleLandingPageAssetUpload = (req: AuthenticatedRequest, res: any, next: (err?: any) => void) => {
  landingPageAssetUpload.single('asset')(req as any, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err?.message || 'Failed to upload image' });
    }
    return next();
  });
};

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

function asPlainObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function decorateListing<T extends { listing?: any | null; customContent?: any }>(page: T) {
  if (!page.listing) return page;

  const galleryImages = page.customContent && typeof page.customContent === 'object' && !Array.isArray(page.customContent)
    ? extractPhotoUrls((page.customContent as Record<string, unknown>).galleryImages)
    : [];
  const mlsPhotos = extractPhotoUrls(page.listing?.mlsImports?.[0]?.photos);
  const photos = Array.from(new Set([
    ...galleryImages,
    page.listing.heroImageUrl,
    page.listing.primaryImageUrl,
    ...mlsPhotos,
  ].filter(Boolean)));

  const { mlsImports, ...listing } = page.listing;
  return {
    ...page,
    listing: {
      ...listing,
      photos,
    },
  };
}

// Get all landing pages for agent
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const landingPages = await prisma.landingPage.findMany({
      where: {
        agentId: req.user!.id,
      },
      include: {
        listing: {
          include: {
            mlsImports: {
              orderBy: { lastFetchedAt: 'desc' },
              take: 1,
            },
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

    res.json(
      landingPages.map((page) => ({
        ...decorateListing(page),
        uniqueViews: page.uniqueViews,
        conversionRate: page.totalViews > 0 ? Number(((page.leadsGenerated / page.totalViews) * 100).toFixed(2)) : 0,
      })),
    );
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
        listing: {
          include: {
            mlsImports: {
              orderBy: { lastFetchedAt: 'desc' },
              take: 1,
            },
          },
        },
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

    const customContent = landingPage.customContent && typeof landingPage.customContent === 'object' && !Array.isArray(landingPage.customContent)
      ? (landingPage.customContent as Record<string, any>)
      : {};

    const decoratedLandingPage = decorateListing(landingPage);

    res.json({
      ...decoratedLandingPage,
      seoSettings: customContent.seoSettings || {},
      leadCapture: customContent.leadCapture || {},
      forceCapture: customContent.forceCapture || {},
      sections: customContent.sections || {},
    });
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
      isActive,
      customContent,
      customStyles,
      seoSettings,
      leadCapture,
      forceCapture,
      sections,
    } = req.body;

    // Check if slug is unique
    const existing = await prisma.landingPage.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Slug already in use' });
    }

    const initialCustomContent = {
      ...asPlainObject(customContent),
      ...(seoSettings !== undefined ? { seoSettings: asPlainObject(seoSettings) } : {}),
      ...(leadCapture !== undefined ? { leadCapture: asPlainObject(leadCapture) } : {}),
      ...(forceCapture !== undefined ? { forceCapture: asPlainObject(forceCapture) } : {}),
      ...(sections !== undefined ? { sections: asPlainObject(sections) } : {}),
    };
    const initialCustomStyles = asPlainObject(customStyles);

    const landingPage = await prisma.landingPage.create({
      data: {
        agentId: req.user!.id,
        listingId,
        slug,
        customDomain,
        title,
        description,
        heroImage,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        templateId: templateId || 'design-67',
        customContent: Object.keys(initialCustomContent).length ? initialCustomContent as any : undefined,
        customStyles: Object.keys(initialCustomStyles).length ? initialCustomStyles as any : undefined,
      },
    });

    res.status(201).json(landingPage);
  } catch (error) {
    console.error('Error creating landing page:', error);
    res.status(500).json({ error: 'Failed to create landing page' });
  }
});

router.post('/:id/assets', handleLandingPageAssetUpload, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const landingPage = await prisma.landingPage.findFirst({
      where: {
        id: req.params.id,
        agentId,
      },
      select: { id: true },
    });

    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetUrl = await persistLandingPageAsset(req.file, landingPage.id, agentId);
    return res.json({ assetUrl, kind: String(req.body.kind || 'asset') });
  } catch (error: any) {
    console.error('Error uploading landing page asset:', error);
    return res.status(500).json({ error: error?.message || 'Failed to upload landing page asset' });
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
      seoSettings,
      leadCapture,
      forceCapture,
      sections,
    } = req.body;

    const existingPage = await prisma.landingPage.findFirst({
      where: { id: req.params.id, agentId },
    });

    if (!existingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

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
    const existingCustomContent = existingPage.customContent && typeof existingPage.customContent === 'object' && !Array.isArray(existingPage.customContent)
      ? (existingPage.customContent as Record<string, any>)
      : {};
    const existingCustomStyles = existingPage.customStyles && typeof existingPage.customStyles === 'object' && !Array.isArray(existingPage.customStyles)
      ? (existingPage.customStyles as Record<string, any>)
      : {};

    const updateData: any = {};
    if (slug !== undefined) updateData.slug = slug;
    if (customDomain !== undefined) updateData.customDomain = customDomain;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (heroImage !== undefined) updateData.heroImage = heroImage;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (customContent !== undefined || seoSettings !== undefined || leadCapture !== undefined || forceCapture !== undefined || sections !== undefined) {
      updateData.customContent = {
        ...existingCustomContent,
        ...(customContent && typeof customContent === 'object' ? customContent : {}),
        ...(seoSettings !== undefined ? { seoSettings } : {}),
        ...(leadCapture !== undefined ? { leadCapture } : {}),
        ...(forceCapture !== undefined ? { forceCapture } : {}),
        ...(sections !== undefined ? { sections } : {}),
      };
    }
    if (customStyles !== undefined) {
      updateData.customStyles = {
        ...existingCustomStyles,
        ...(customStyles && typeof customStyles === 'object' ? customStyles : {}),
      };
    }

    const landingPage = await prisma.landingPage.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(landingPage);
  } catch (error) {
    console.error('Error updating landing page:', error);
    res.status(500).json({ error: 'Failed to update landing page' });
  }
});

// Clone/duplicate an existing landing page
router.post('/:id/clone', async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const source = await prisma.landingPage.findFirst({
      where: { id: req.params.id, agentId },
    });

    if (!source) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    // Generate a unique slug by appending -copy / -copy-2, etc.
    const baseSlug = `${source.slug}-copy`.slice(0, 60);
    let newSlug = baseSlug;
    let attempt = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await prisma.landingPage.findUnique({ where: { slug: newSlug } });
      if (!exists) break;
      attempt += 1;
      newSlug = `${baseSlug}-${attempt}`.slice(0, 60);
      if (attempt > 50) {
        newSlug = `${baseSlug}-${Date.now()}`.slice(0, 60);
        break;
      }
    }

    const cloned = await prisma.landingPage.create({
      data: {
        agentId,
        listingId: source.listingId,
        slug: newSlug,
        customDomain: null,
        title: `${source.title} (Copy)`.slice(0, 120),
        description: source.description,
        heroImage: source.heroImage,
        templateId: source.templateId,
        isActive: false,
        customContent: source.customContent as any,
        customStyles: source.customStyles as any,
      },
    });

    res.status(201).json(cloned);
  } catch (error) {
    console.error('Error cloning landing page:', error);
    res.status(500).json({ error: 'Failed to clone landing page' });
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
      select: { id: true, customContent: true },
    });

    if (!owned) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const customContent = owned.customContent && typeof owned.customContent === 'object' && !Array.isArray(owned.customContent)
      ? (owned.customContent as Record<string, unknown>)
      : {};
    const qrListingToken = String(customContent.qrListingToken || '').trim();

    const [
      pageViews,
      uniqueVisitors,
      leads,
      qrViews,
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
      prisma.pageView.count({
        where: {
          landingPageId: id,
          createdAt: { gte: startDate },
          OR: [
            { utmSource: 'qr' },
            { utmMedium: 'print' },
            ...(qrListingToken ? [{ utmContent: qrListingToken }] : []),
          ],
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
        qrViews,
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
