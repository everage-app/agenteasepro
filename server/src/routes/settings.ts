import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  getIdxConnectionForAgent, 
  upsertIdxConnection, 
  testIdxConnection 
} from '../services/idxService';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const router = Router();

const getUploadsBaseDir = () => {
  const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  return process.env.NODE_ENV === 'production'
    ? path.join(tmpDir, 'agentease-uploads')
    : path.join(__dirname, '../../uploads');
};

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const agentId = (req as AuthenticatedRequest).agentId || 'default';
    const ext = path.extname(file.originalname);
    cb(null, `logo-${agentId}-${Date.now()}${ext}`);
  }
});

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
    'image/svg+xml',
    'image/webp',
    'image/heic',
    'image/heif'
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'));
  }
};

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: imageFileFilter
});

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const agentId = (req as AuthenticatedRequest).agentId || 'default';
    const ext = path.extname(file.originalname);
    cb(null, `profile-${agentId}-${Date.now()}${ext}`);
  }
});

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: imageFileFilter
});

const handleLogoUpload = (req: Request, res: Response, next: (err?: any) => void) => {
  logoUpload.single('logo')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err?.message || 'Failed to upload logo' });
    }
    return next();
  });
};

const handleProfilePhotoUpload = (req: Request, res: Response, next: (err?: any) => void) => {
  profilePhotoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err?.message || 'Failed to upload photo' });
    }
    return next();
  });
};

// Configure multer for CSV imports
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}.csv`);
  }
});

const csvUpload = multer({
  storage: csvStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * GET /api/settings/idx
 * Get the current agent's IDX connection (with masked secrets)
 */
router.get('/idx', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const connection = await getIdxConnectionForAgent(req.agentId);
    
    if (!connection) {
      return res.status(404).json({ error: 'No IDX connection found' });
    }

    return res.json(connection);
  } catch (error: any) {
    console.error('Failed to get IDX connection:', error);
    return res.status(500).json({ error: 'Failed to retrieve IDX connection' });
  }
});

/**
 * POST /api/settings/idx
 * Create or update the current agent's IDX connection
 */
router.post('/idx', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      providerType,
      vendorName,
      baseUrl,
      clientId,
      clientSecret,
      serverToken,
      browserToken,
      apiKey,
      mlsAgentIds,
    } = req.body;

    // Basic validation
    if (!providerType || !baseUrl) {
      return res.status(400).json({ error: 'Provider type and base URL are required' });
    }

    if (providerType === 'UTAH_RESO_WEBAPI') {
      // For Utah RESO, we need at minimum clientId and clientSecret
      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'Client ID and Client Secret are required for Utah RESO Web API' });
      }
    } else if (providerType === 'GENERIC_API') {
      // For generic API, we need at minimum an API key
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required for generic IDX providers' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid provider type' });
    }

    const connection = await upsertIdxConnection(req.agentId, {
      providerType,
      vendorName,
      baseUrl,
      clientId,
      clientSecret,
      serverToken,
      browserToken,
      apiKey,
      mlsAgentIds,
    });

    return res.json({ 
      success: true, 
      message: 'IDX connection saved successfully',
      connectionId: connection.id 
    });
  } catch (error: any) {
    console.error('Failed to save IDX connection:', error);
    return res.status(500).json({ error: 'Failed to save IDX connection' });
  }
});

/**
 * POST /api/settings/idx/test
 * Test the current agent's IDX connection
 */
router.post('/idx/test', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await testIdxConnection(req.agentId);
    
    if (!result.ok) {
      return res.status(400).json({ 
        ok: false, 
        error: result.error || 'Connection test failed' 
      });
    }

    return res.json(result);
  } catch (error: any) {
    console.error('IDX connection test failed:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Connection test failed. Please try again.' 
    });
  }
});

// AI assistance settings
router.get('/ai', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settings = await prisma.agentAiSettings.findUnique({
      where: { agentId: req.agentId },
    });

    return res.json({
      aiAssistanceLevel: settings?.level ?? 'MEDIUM',
    });
  } catch (error: any) {
    console.error('Failed to get AI settings:', error);
    return res.status(500).json({ error: 'Failed to retrieve AI settings' });
  }
});

router.post('/ai', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { aiAssistanceLevel } = req.body as { aiAssistanceLevel?: string };
  if (!aiAssistanceLevel || !['OFF', 'LOW', 'MEDIUM', 'HIGH'].includes(aiAssistanceLevel)) {
    return res.status(400).json({ error: 'Invalid AI assistance level' });
  }

  try {
    const settings = await prisma.agentAiSettings.upsert({
      where: { agentId: req.agentId },
      create: {
        agentId: req.agentId,
        level: aiAssistanceLevel as any,
      },
      update: {
        level: aiAssistanceLevel as any,
      },
    });

    return res.json({
      success: true,
      aiAssistanceLevel: settings.level,
    });
  } catch (error: any) {
    console.error('Failed to save AI settings:', error);
    return res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// ============================================
// PROFILE SETTINGS
// ============================================

// GET /api/settings/profile - Get agent profile settings
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId },
      select: {
        id: true,
        email: true,
        name: true,
        brokerageName: true,
        licenseNumber: true,
        createdAt: true
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let profileSettings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId }
    });

    if (!profileSettings) {
      profileSettings = await prisma.agentProfileSettings.create({
        data: { agentId: req.agentId }
      });
    }

    return res.json({
      ...agent,
      settings: profileSettings
    });
  } catch (error: any) {
    console.error('Error fetching profile settings:', error);
    return res.status(500).json({ error: 'Failed to fetch profile settings' });
  }
});

// PUT /api/settings/profile - Update agent profile settings
router.put('/profile', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      firstName, 
      lastName, 
      phone,
      licenseNumber,
      licenseSuffix,
      licenseState,
      licenseExpiry,
      narMemberId,
      timezone,
      signatureBlock,
      brokerageName,
      brokerageLogoUrl,
      brokerageAddress,
      brokeragePhone,
      officeAddress,
      brokerageLicense,
      yearsExperience,
      specializations,
      bio
    } = req.body;

    // Update the agent's name if provided
    if (firstName || lastName) {
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      await prisma.agent.update({
        where: { id: req.agentId },
        data: { 
          name: fullName,
          brokerageName,
          licenseNumber
        }
      });
    }

    // Parse licenseExpiry to Date if provided
    let licenseExpiryDate: Date | null = null;
    if (licenseExpiry) {
      licenseExpiryDate = new Date(licenseExpiry);
      if (isNaN(licenseExpiryDate.getTime())) {
        licenseExpiryDate = null;
      }
    }

    // Parse yearsExperience to number if provided
    let yearsExp: number | null = null;
    if (yearsExperience !== undefined && yearsExperience !== '' && yearsExperience !== null) {
      yearsExp = parseInt(yearsExperience, 10);
      if (isNaN(yearsExp)) yearsExp = null;
    }

    const profileSettings = await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: {
        agentId: req.agentId,
        firstName,
        lastName,
        phone,
        licenseNumber,
        licenseSuffix,
        licenseState,
        licenseExpiry: licenseExpiryDate,
        narMemberId,
        timezone: timezone || 'America/Denver',
        signatureBlock,
        brokerageName,
        brokerageLogoUrl,
        brokerageAddress,
        brokeragePhone,
        officeAddress,
        brokerageLicense,
        yearsExperience: yearsExp,
        specializations,
        bio
      },
      update: {
        firstName,
        lastName,
        phone,
        licenseNumber,
        licenseSuffix,
        licenseState,
        licenseExpiry: licenseExpiryDate,
        narMemberId,
        timezone,
        signatureBlock,
        brokerageName,
        brokerageLogoUrl,
        brokerageAddress,
        brokeragePhone,
        officeAddress,
        brokerageLicense,
        yearsExperience: yearsExp,
        specializations,
        bio
      }
    });

    return res.json({ 
      message: 'Profile updated successfully',
      settings: profileSettings
    });
  } catch (error: any) {
    console.error('Error updating profile settings:', error);
    return res.status(500).json({ error: 'Failed to update profile settings' });
  }
});

// ============================================
// BRANDING SETTINGS
// ============================================

// GET /api/settings/branding - Get branding settings
router.get('/branding', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let settings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: {
        logoUrl: true,
        brandColor: true,
        accentColor: true,
        emailFooter: true,
        websiteUrl: true,
        facebookUrl: true,
        instagramUrl: true,
        linkedinUrl: true
      }
    });

    if (!settings) {
      settings = await prisma.agentProfileSettings.create({
        data: { agentId: req.agentId },
        select: {
          logoUrl: true,
          brandColor: true,
          accentColor: true,
          emailFooter: true,
          websiteUrl: true,
          facebookUrl: true,
          instagramUrl: true,
          linkedinUrl: true
        }
      });
    }

    return res.json({
      logoUrl: settings.logoUrl,
      primaryColor: settings.brandColor,
      secondaryColor: settings.accentColor,
      emailSignature: settings.emailFooter,
      websiteUrl: settings.websiteUrl,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      linkedinUrl: settings.linkedinUrl,
      // Not yet persisted in DB schema, but expected by the UI
      fontPreference: null,
      youtubeUrl: null,
    });
  } catch (error: any) {
    console.error('Error fetching branding settings:', error);
    return res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
});

// PUT /api/settings/branding - Update branding settings
router.put('/branding', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = req.body || {};

    // Support both legacy API names (brandColor/accentColor/emailFooter)
    // and UI names (primaryColor/secondaryColor/emailSignature).
    const brandColor = body.brandColor ?? body.primaryColor;
    const accentColor = body.accentColor ?? body.secondaryColor;
    const emailFooter = body.emailFooter ?? body.emailSignature;
    const websiteUrl = body.websiteUrl;
    const googleAnalyticsId = body.googleAnalyticsId;
    const facebookUrl = body.facebookUrl;
    const instagramUrl = body.instagramUrl;
    const linkedinUrl = body.linkedinUrl;

    const settings = await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: {
        agentId: req.agentId,
        brandColor,
        accentColor,
        emailFooter,
        websiteUrl,
        googleAnalyticsId,
        facebookUrl,
        instagramUrl,
        linkedinUrl
      },
      update: {
        brandColor,
        accentColor,
        emailFooter,
        websiteUrl,
        googleAnalyticsId,
        facebookUrl,
        instagramUrl,
        linkedinUrl
      }
    });

    return res.json({
      message: 'Branding settings updated successfully',
      settings
    });
  } catch (error: any) {
    console.error('Error updating branding settings:', error);
    return res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// POST /api/settings/branding/logo - Upload logo
router.post('/branding/logo', handleLogoUpload, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    const oldSettings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { logoUrl: true }
    });

    await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: { agentId: req.agentId, logoUrl },
      update: { logoUrl }
    });

    if (oldSettings?.logoUrl) {
      const relativeOld = oldSettings.logoUrl.replace(/^\/?uploads\/+/, '');
      const oldPath = path.join(getUploadsBaseDir(), relativeOld);
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (unlinkErr) {
        console.warn('Unable to delete old branding logo:', unlinkErr);
      }
    }

    return res.json({ message: 'Logo uploaded successfully', logoUrl });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({ error: error?.message || 'Failed to upload logo' });
  }
});

// POST /api/settings/profile/brokerage-logo - Upload brokerage logo
router.post('/profile/brokerage-logo', handleLogoUpload, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const brokerageLogoUrl = `/uploads/logos/${req.file.filename}`;

    const oldSettings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { brokerageLogoUrl: true }
    });

    await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: { agentId: req.agentId, brokerageLogoUrl },
      update: { brokerageLogoUrl }
    });

    if (oldSettings?.brokerageLogoUrl) {
      const relativeOld = oldSettings.brokerageLogoUrl.replace(/^\/?uploads\/+/, '');
      const oldPath = path.join(getUploadsBaseDir(), relativeOld);
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (unlinkErr) {
        console.warn('Unable to delete old brokerage logo:', unlinkErr);
      }
    }

    return res.json({ message: 'Brokerage logo uploaded successfully', brokerageLogoUrl });
  } catch (error: any) {
    console.error('Error uploading brokerage logo:', error);
    return res.status(500).json({ error: error?.message || 'Failed to upload brokerage logo' });
  }
});

// DELETE /api/settings/profile/brokerage-logo - Remove brokerage logo
router.delete('/profile/brokerage-logo', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { brokerageLogoUrl: true }
    });

    if (settings?.brokerageLogoUrl) {
      const relativeLogo = settings.brokerageLogoUrl.replace(/^\/?uploads\/+/, '');
      const filePath = path.join(getUploadsBaseDir(), relativeLogo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: { agentId: req.agentId, brokerageLogoUrl: null },
      update: { brokerageLogoUrl: null }
    });

    return res.json({ message: 'Brokerage logo removed successfully' });
  } catch (error: any) {
    console.error('Error removing brokerage logo:', error);
    return res.status(500).json({ error: 'Failed to remove brokerage logo' });
  }
});

// POST /api/settings/profile/photo - Upload profile photo
router.post('/profile/photo', handleProfilePhotoUpload, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;

    const oldSettings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { photoUrl: true }
    });

    await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: { agentId: req.agentId, photoUrl },
      update: { photoUrl }
    });

    if (oldSettings?.photoUrl) {
      const relativeOld = oldSettings.photoUrl.replace(/^\/?uploads\/+/, '');
      const oldPath = path.join(getUploadsBaseDir(), relativeOld);
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (unlinkErr) {
        console.warn('Unable to delete old profile photo:', unlinkErr);
      }
    }

    return res.json({ message: 'Profile photo uploaded successfully', photoUrl });
  } catch (error: any) {
    console.error('Error uploading profile photo:', error);
    return res.status(500).json({ error: error?.message || 'Failed to upload profile photo' });
  }
});

// DELETE /api/settings/profile/photo - Remove profile photo
router.delete('/profile/photo', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { photoUrl: true }
    });

    if (settings?.photoUrl) {
      const relativePhoto = settings.photoUrl.replace(/^\/?uploads\/+/, '');
      const filePath = path.join(getUploadsBaseDir(), relativePhoto);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.agentProfileSettings.upsert({
      where: { agentId: req.agentId },
      create: { agentId: req.agentId, photoUrl: null },
      update: { photoUrl: null }
    });

    return res.json({ message: 'Profile photo removed successfully' });
  } catch (error: any) {
    console.error('Error removing profile photo:', error);
    return res.status(500).json({ error: 'Failed to remove profile photo' });
  }
});

// DELETE /api/settings/branding/logo - Remove logo
router.delete('/branding/logo', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settings = await prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: { logoUrl: true }
    });

    if (settings?.logoUrl) {
      const relativeLogo = settings.logoUrl.replace(/^\/+/, '');
      const filePath = path.join(__dirname, '../..', relativeLogo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.agentProfileSettings.update({
      where: { agentId: req.agentId },
      data: { logoUrl: null }
    });

    return res.json({ message: 'Logo removed successfully' });
  } catch (error: any) {
    console.error('Error removing logo:', error);
    return res.status(500).json({ error: 'Failed to remove logo' });
  }
});

// ============================================
// NOTIFICATION SETTINGS
// ============================================

// GET /api/settings/notifications - Get notification preferences
router.get('/notifications', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let prefs = await prisma.agentNotificationPrefs.findUnique({
      where: { agentId: req.agentId }
    });

    if (!prefs) {
      prefs = await prisma.agentNotificationPrefs.create({
        data: { agentId: req.agentId }
      });
    }

    return res.json(prefs);
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// PUT /api/settings/notifications - Update notification preferences
router.put('/notifications', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      deadlineEmails,
      dailyPlanEnabled,
      dailyPlanTime,
      inAppBanners,
      signatureAlerts,
      documentComplete,
      marketingSummaries,
      quietHoursStart,
      quietHoursEnd
    } = req.body;

    const prefs = await prisma.agentNotificationPrefs.upsert({
      where: { agentId: req.agentId },
      create: {
        agentId: req.agentId,
        deadlineEmails,
        dailyPlanEnabled,
        dailyPlanTime,
        inAppBanners,
        signatureAlerts,
        documentComplete,
        marketingSummaries,
        quietHoursStart,
        quietHoursEnd
      },
      update: {
        deadlineEmails,
        dailyPlanEnabled,
        dailyPlanTime,
        inAppBanners,
        signatureAlerts,
        documentComplete,
        marketingSummaries,
        quietHoursStart,
        quietHoursEnd
      }
    });

    return res.json({
      message: 'Notification preferences updated successfully',
      prefs
    });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    return res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// ============================================
// DATA IMPORT/EXPORT
// ============================================

// POST /api/settings/import/preview - Preview CSV import
router.post('/import/preview', csvUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Empty CSV file' });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const previewRows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    const suggestedMappings: Record<string, string> = {};
    const clientFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zip', 'notes', 'source', 'type'];
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().replace(/[_\s]/g, '');
      
      if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
        suggestedMappings[header] = 'firstName';
      } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
        suggestedMappings[header] = 'lastName';
      } else if (lowerHeader === 'name' || lowerHeader === 'fullname') {
        suggestedMappings[header] = 'fullName';
      } else if (lowerHeader.includes('email')) {
        suggestedMappings[header] = 'email';
      } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
        suggestedMappings[header] = 'phone';
      } else if (lowerHeader.includes('address') || lowerHeader.includes('street')) {
        suggestedMappings[header] = 'address';
      } else if (lowerHeader === 'city') {
        suggestedMappings[header] = 'city';
      } else if (lowerHeader === 'state') {
        suggestedMappings[header] = 'state';
      } else if (lowerHeader === 'zip' || lowerHeader === 'zipcode' || lowerHeader === 'postalcode') {
        suggestedMappings[header] = 'zip';
      } else if (lowerHeader.includes('note') || lowerHeader.includes('comment')) {
        suggestedMappings[header] = 'notes';
      } else if (lowerHeader.includes('source') || lowerHeader.includes('lead')) {
        suggestedMappings[header] = 'source';
      } else if (lowerHeader.includes('type') || lowerHeader.includes('category')) {
        suggestedMappings[header] = 'type';
      }
    });

    return res.json({
      success: true,
      filePath: req.file.path,
      totalRows: lines.length - 1,
      headers,
      previewRows,
      suggestedMappings,
      availableFields: clientFields
    });
  } catch (error: any) {
    console.error('Error previewing CSV:', error);
    return res.status(500).json({ error: 'Failed to preview CSV file' });
  }
});

// POST /api/settings/import/clients - Import clients from CSV
router.post('/import/clients', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { filePath, mappings, skipDuplicates = true } = req.body;

    if (!filePath || !mappings) {
      return res.status(400).json({ error: 'File path and mappings are required' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Import file not found. Please upload again.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as string[]
    };

    const existingClients = await prisma.client.findMany({
      where: { agentId: req.agentId },
      select: { email: true }
    });
    const existingEmails = new Set(existingClients.map(c => c.email?.toLowerCase()).filter(Boolean));

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowData[header] = values[idx] || '';
        });

        const clientData: any = { agentId: req.agentId };
        
        for (const [csvColumn, dbField] of Object.entries(mappings as Record<string, string>)) {
          if (dbField && rowData[csvColumn]) {
            if (dbField === 'fullName') {
              const nameParts = rowData[csvColumn].split(' ');
              clientData.firstName = nameParts[0] || '';
              clientData.lastName = nameParts.slice(1).join(' ') || '';
            } else if (dbField === 'source') {
              clientData.leadSource = rowData[csvColumn];
            } else if (dbField === 'type') {
              // Map type to role (BUYER/SELLER)
              const roleValue = rowData[csvColumn].toUpperCase();
              if (roleValue === 'BUYER' || roleValue === 'SELLER') {
                clientData.role = roleValue;
              }
            } else {
              clientData[dbField] = rowData[csvColumn];
            }
          }
        }

        if (!clientData.firstName && !clientData.lastName && !clientData.email) {
          results.errors.push(`Row ${i}: Missing required fields (name or email)`);
          continue;
        }

        if (skipDuplicates && clientData.email && existingEmails.has(clientData.email.toLowerCase())) {
          results.skipped++;
          continue;
        }

        // Set defaults
        clientData.role = clientData.role || 'BUYER';
        clientData.stage = 'NEW_LEAD';

        await prisma.client.create({ data: clientData });
        results.success++;

        if (clientData.email) {
          existingEmails.add(clientData.email.toLowerCase());
        }
      } catch (rowError: any) {
        results.errors.push(`Row ${i}: ${rowError.message}`);
      }
    }

    fs.unlinkSync(filePath);

    return res.json({
      message: 'Import completed',
      ...results
    });
  } catch (error: any) {
    console.error('Error importing clients:', error);
    return res.status(500).json({ error: 'Failed to import clients' });
  }
});

// GET /api/settings/export/clients - Export clients as CSV
router.get('/export/clients', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const clients = await prisma.client.findMany({
      where: { agentId: req.agentId },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Stage', 'Lead Source', 'Referral Rank', 'Tags', 'Notes', 'Created At'];
    const rows = clients.map(c => [
      c.firstName || '',
      c.lastName || '',
      c.email || '',
      c.phone || '',
      c.role || '',
      c.stage || '',
      c.leadSource || '',
      c.referralRank || '',
      (c.tags || []).join('; '),
      (c.notes || '').replace(/"/g, '""'),
      c.createdAt?.toISOString() || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=clients-export-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error: any) {
    console.error('Error exporting clients:', error);
    return res.status(500).json({ error: 'Failed to export clients' });
  }
});

// GET /api/settings/export/deals - Export deals as CSV
router.get('/export/deals', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const deals = await prisma.deal.findMany({
      where: { agentId: req.agentId },
      include: {
        property: {
          select: { street: true, city: true, state: true, zip: true }
        },
        buyer: {
          select: { firstName: true, lastName: true, email: true }
        },
        seller: {
          select: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['Title', 'Property Address', 'Buyer Name', 'Seller Name', 'Status', 'Offer Date', 'Created At'];
    const rows = deals.map((d: any) => [
      d.title || '',
      d.property ? `${d.property.street || ''}, ${d.property.city || ''}, ${d.property.state || ''} ${d.property.zip || ''}` : '',
      d.buyer ? `${d.buyer.firstName || ''} ${d.buyer.lastName || ''}`.trim() : '',
      d.seller ? `${d.seller.firstName || ''} ${d.seller.lastName || ''}`.trim() : '',
      d.status || '',
      d.offerReferenceDate?.toISOString().split('T')[0] || '',
      d.createdAt?.toISOString() || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=deals-export-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error: any) {
    console.error('Error exporting deals:', error);
    return res.status(500).json({ error: 'Failed to export deals' });
  }
});

// GET /api/settings/export/listings - Export listings as CSV
router.get('/export/listings', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const listings = await prisma.listing.findMany({
      where: { agentId: req.agentId },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['MLS ID', 'Address', 'City', 'State', 'Zip', 'Price', 'Beds', 'Baths', 'Sqft', 'Status', 'Headline', 'Description'];
    const rows = listings.map(l => [
      l.mlsId || '',
      l.addressLine1 || '',
      l.city || '',
      l.state || '',
      l.zipCode || '',
      l.price?.toString() || '',
      l.beds?.toString() || '',
      l.baths?.toString() || '',
      l.sqft?.toString() || '',
      l.status || '',
      (l.headline || '').replace(/"/g, '""'),
      (l.description || '').replace(/"/g, '""')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=listings-export-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error: any) {
    console.error('Error exporting listings:', error);
    return res.status(500).json({ error: 'Failed to export listings' });
  }
});

// GET /api/settings/export/all - Export all data as JSON
router.get('/export/all', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [clients, deals, listings, tasks] = await Promise.all([
      prisma.client.findMany({ where: { agentId: req.agentId } }),
      prisma.deal.findMany({ where: { agentId: req.agentId } }),
      prisma.listing.findMany({ where: { agentId: req.agentId } }),
      prisma.task.findMany({ where: { agentId: req.agentId } })
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      clients,
      deals,
      listings,
      tasks
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=agentease-export-${Date.now()}.json`);
    return res.json(exportData);
  } catch (error: any) {
    console.error('Error exporting all data:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// Multer error handling (logo uploads, CSV imports)
router.use((err: any, req: Request, res: Response, next: (err?: any) => void) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});
