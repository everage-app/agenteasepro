import { Router } from 'express';
import {
  ClientRole,
  ClientStage,
  ClientTemperature,
  DealStatus,
  LeadPriority,
  LeadSource,
  TaskBucket,
  TaskCategory,
  TaskCreatedFrom,
  TaskPriority,
} from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { getLegalPolicies, recordAgentLegalAcceptance } from '../lib/legalPolicies';
import { sendPasswordResetEmail } from '../services/emailService';
import {
  signup as idSignup,
  login as idLogin,
  refreshAccessToken,
  revokeRefreshToken,
  requestPasswordReset,
  executePasswordReset,
  changePassword,
  signLegacyToken,
  validatePassword,
  verifyEmail,
  resendVerificationCode,
} from '../services/identityService';
import { auditLog, extractIp } from '../services/securityAuditService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

export const router = Router();

// ── Rate limiting for auth endpoints ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// Apply to all auth routes
router.use(authLimiter);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const SignupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

/** RequestContext helper */
function reqCtx(req: any) {
  return { ip: extractIp(req), userAgent: req.get?.('user-agent') || undefined };
}

const dayMs = 24 * 60 * 60 * 1000;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * dayMs);
}

function todayAsDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function ensureDemoSampleClients(agentId: string) {
  const samples = [
    {
      firstName: 'Maya',
      lastName: 'Thompson',
      email: 'maya.thompson.demo@example.com',
      phone: '3855550101',
      role: ClientRole.BUYER,
      stage: ClientStage.UNDER_CONTRACT,
      temperature: ClientTemperature.HOT,
      leadSource: 'Open House',
      referralRank: 'A' as const,
      notes: 'Demo buyer under contract in Sugar House. Wants clear deadline reminders and fast signing updates.',
      tags: ['demo', 'buyer', 'under-contract'],
      lastContactAt: daysFromNow(-1),
    },
    {
      firstName: 'Evan',
      lastName: 'Park',
      email: 'evan.park.demo@example.com',
      phone: '3855550102',
      role: ClientRole.SELLER,
      stage: ClientStage.UNDER_CONTRACT,
      temperature: ClientTemperature.HOT,
      leadSource: 'Past Client Referral',
      referralRank: 'B' as const,
      notes: 'Demo seller for the Sugar House contract packet. Needs disclosure reminder before the deadline.',
      tags: ['demo', 'seller', 'contract'],
      lastContactAt: daysFromNow(-2),
    },
    {
      firstName: 'Jordan',
      lastName: 'Lee',
      email: 'jordan.lee.demo@example.com',
      phone: '3855550103',
      role: ClientRole.OTHER,
      stage: ClientStage.PAST_CLIENT,
      temperature: ClientTemperature.WARM,
      leadSource: 'Open House',
      referralRank: 'A' as const,
      notes: 'Past client and referral source. Good fit for the Win the Day referral workflow.',
      tags: ['demo', 'past-client', 'referral'],
      referralsGiven: 3,
      referralsClosed: 1,
      lastContactAt: daysFromNow(-7),
    },
  ];

  const keepIds: string[] = [];

  for (const sample of samples) {
    const existing = await prisma.client.findFirst({
      where: {
        agentId,
        email: sample.email,
      },
      select: { id: true },
    });

    if (existing) {
      keepIds.push(existing.id);
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          firstName: sample.firstName,
          lastName: sample.lastName,
          phone: sample.phone,
          role: sample.role,
          stage: sample.stage,
          temperature: sample.temperature,
          leadSource: sample.leadSource,
          referralRank: sample.referralRank,
          notes: sample.notes,
          tags: sample.tags,
          referralsGiven: sample.referralsGiven ?? 0,
          referralsClosed: sample.referralsClosed ?? 0,
          lastContactAt: sample.lastContactAt,
        },
      });
      continue;
    }

    const created = await prisma.client.create({
      data: {
        agentId,
        firstName: sample.firstName,
        lastName: sample.lastName,
        email: sample.email,
        phone: sample.phone,
        role: sample.role,
        stage: sample.stage,
        temperature: sample.temperature,
        leadSource: sample.leadSource,
        referralRank: sample.referralRank,
        notes: sample.notes,
        tags: sample.tags,
        referralsGiven: sample.referralsGiven ?? 0,
        referralsClosed: sample.referralsClosed ?? 0,
        lastContactAt: sample.lastContactAt,
      },
      select: { id: true },
    });
    keepIds.push(created.id);
  }

  // Best-effort cleanup: remove extra demo clients that aren't referenced by anything.
  // (Avoids FK violations for demo data that may have deals/tasks attached.)
  try {
    const others = await prisma.client.findMany({
      where: {
        agentId,
        id: { notIn: keepIds },
      },
      select: {
        id: true,
        _count: {
          select: {
            buyerDeals: true,
            sellerDeals: true,
            tasks: true,
            leads: true,
            savedListings: true,
            searchCriteria: true,
          },
        },
      },
    });

    const deletableIds = others
      .filter(c => {
        const counts = c._count;
        return (
          counts.buyerDeals === 0 &&
          counts.sellerDeals === 0 &&
          counts.tasks === 0 &&
          counts.leads === 0 &&
          counts.savedListings === 0 &&
          counts.searchCriteria === 0
        );
      })
      .map(c => c.id);

    if (deletableIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: deletableIds } },
      });
    }
  } catch (err) {
    console.warn('Demo client cleanup skipped:', err);
  }

  return {
    buyerId: keepIds[0],
    sellerId: keepIds[1],
    referralClientId: keepIds[2],
  };
}

async function ensureDemoTask(input: {
  agentId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  bucket: TaskBucket;
  dueAt: Date;
  dealId?: string;
  clientId?: string;
}) {
  const existing = await prisma.task.findFirst({
    where: { agentId: input.agentId, title: input.title },
    select: { id: true },
  });

  const data = {
    description: input.description,
    category: input.category,
    priority: input.priority,
    bucket: input.bucket,
    status: 'OPEN' as const,
    dueAt: input.dueAt,
    dealId: input.dealId,
    clientId: input.clientId,
    createdFrom: TaskCreatedFrom.SYSTEM,
  };

  if (existing) {
    await prisma.task.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.task.create({
    data: {
      agentId: input.agentId,
      title: input.title,
      ...data,
    },
  });
}

async function ensureDemoWorkspace(agentId: string) {
  const clients = await ensureDemoSampleClients(agentId);

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      name: 'AgentEasePro Demo Agent',
      brokerageName: 'Wasatch Front Realty Demo',
      licenseNumber: 'DEMO-UT-0001',
      emailVerified: true,
      billingMode: 'STANDARD',
      billingAccessOverride: true,
      subscriptionStatus: 'ACTIVE',
    },
  });

  await prisma.agentProfileSettings.upsert({
    where: { agentId },
    create: {
      agentId,
      firstName: 'Demo',
      lastName: 'Agent',
      phone: '385-555-0199',
      licenseNumber: 'DEMO-UT-0001',
      licenseState: 'UT',
      brokerageName: 'Wasatch Front Realty Demo',
      brokeragePhone: '385-555-0100',
      brokerageAddress: '136 S Main St, Salt Lake City, UT 84101',
      brandColor: '#d6b56d',
      accentColor: '#06b6d4',
      yearsExperience: 8,
      specializations: 'Utah buyers, sellers, REPC workflows, and listing launches',
      bio: 'A polished demo profile showing how AgentEasePro keeps contracts, deadlines, clients, and marketing in one workspace.',
    },
    update: {
      firstName: 'Demo',
      lastName: 'Agent',
      phone: '385-555-0199',
      licenseNumber: 'DEMO-UT-0001',
      licenseState: 'UT',
      brokerageName: 'Wasatch Front Realty Demo',
      brokeragePhone: '385-555-0100',
      brokerageAddress: '136 S Main St, Salt Lake City, UT 84101',
      brandColor: '#d6b56d',
      accentColor: '#06b6d4',
      yearsExperience: 8,
      specializations: 'Utah buyers, sellers, REPC workflows, and listing launches',
      bio: 'A polished demo profile showing how AgentEasePro keeps contracts, deadlines, clients, and marketing in one workspace.',
    },
  });

  const listingSeed = {
    mlsId: 'DEMO-UT-1024',
    addressLine1: '1438 E Bryan Ave',
    city: 'Salt Lake City',
    state: 'UT',
    zipCode: '84105',
    headline: 'Sugar House Craftsman with Mountain Views',
    description: 'A polished demo listing with updated living spaces, a fenced backyard, and quick access to Sugar House Park.',
    price: 725000,
    beds: 4,
    baths: 2.5,
    sqft: 2450,
    primaryImageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    heroImageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80',
    status: 'ACTIVE' as const,
    isFeatured: true,
    totalBlasts: 2,
    totalClicks: 37,
    goLiveDate: daysFromNow(-5),
    nextOpenHouseAt: daysFromNow(3),
  };

  const existingListing = await prisma.listing.findFirst({
    where: { agentId, mlsId: listingSeed.mlsId },
    select: { id: true },
  });
  const listing = existingListing
    ? await prisma.listing.update({ where: { id: existingListing.id }, data: listingSeed })
    : await prisma.listing.create({ data: { agentId, ...listingSeed } });

  const propertySeed = {
    mlsId: listingSeed.mlsId,
    street: listingSeed.addressLine1,
    city: listingSeed.city,
    county: 'Salt Lake',
    state: 'UT',
    zip: listingSeed.zipCode,
    taxId: '16-17-351-024',
    notes: 'Demo property tied to the active REPC and listing launch workflow.',
  };
  const existingProperty = await prisma.property.findFirst({
    where: { agentId, street: propertySeed.street, city: propertySeed.city },
    select: { id: true },
  });
  const property = existingProperty
    ? await prisma.property.update({ where: { id: existingProperty.id }, data: propertySeed })
    : await prisma.property.create({ data: { agentId, ...propertySeed } });

  const dealTitle = 'Demo REPC - 1438 E Bryan Ave';
  const existingDeal = await prisma.deal.findFirst({
    where: { agentId, title: dealTitle, deletedAt: null },
    select: { id: true },
  });
  const dealData = {
    title: dealTitle,
    propertyId: property.id,
    buyerId: clients.buyerId,
    sellerId: clients.sellerId,
    status: DealStatus.UNDER_CONTRACT,
    offerReferenceDate: daysFromNow(-2),
    lastActivityAt: new Date(),
  };
  const deal = existingDeal
    ? await prisma.deal.update({ where: { id: existingDeal.id }, data: dealData })
    : await prisma.deal.create({ data: { agentId, ...dealData } });

  await prisma.repc.upsert({
    where: { dealId: deal.id },
    create: {
      dealId: deal.id,
      buyerLegalNames: 'Maya Thompson',
      sellerLegalNames: 'Evan Park and Kelly Park',
      earnestMoneyAmount: '10000',
      earnestMoneyForm: 'Wire transfer to title company',
      additionalEarnestMoneyAmount: '0',
      propertyCity: 'Salt Lake City',
      propertyCounty: 'Salt Lake',
      propertyState: 'UT',
      propertyZip: '84105',
      propertyTaxId: '16-17-351-024',
      otherIncludedItems: 'Refrigerator, washer, dryer, smart thermostat, and mounted TV brackets',
      excludedItems: 'Seller personal property and staging items',
      purchasePrice: '725000',
      newLoanAmount: '580000',
      sellerFinancingAmount: '0',
      cashAtSettlement: '135000',
      isSubjectToSaleOfBuyersProperty: false,
      possessionTiming: 'ON_RECORDING',
      capitalImprovementsPayer: 'SELLER',
      changeOfOwnershipFeePayer: 'BUYER',
      sellerCompensationContributionPercent: '0',
      sellerCompensationContributionFlat: '5000',
      hasDueDiligenceCondition: true,
      hasAppraisalCondition: true,
      hasFinancingCondition: true,
      sellerDisclosureDeadline: daysFromNow(2),
      dueDiligenceDeadline: daysFromNow(8),
      financingAppraisalDeadline: daysFromNow(14),
      settlementDeadline: daysFromNow(27),
      hasHomeWarranty: true,
      homeWarrantyOrderedBy: 'BUYER',
      homeWarrantyMaxCost: '650',
      offerExpirationDate: daysFromNow(1),
      offerExpirationTime: '5:00',
      offerExpirationMeridiem: 'PM',
      rawJson: {
        demo: true,
        summary: 'Demo REPC packet with upcoming disclosure, due diligence, financing, and settlement dates.',
      },
    },
    update: {
      buyerLegalNames: 'Maya Thompson',
      sellerLegalNames: 'Evan Park and Kelly Park',
      earnestMoneyAmount: '10000',
      earnestMoneyForm: 'Wire transfer to title company',
      additionalEarnestMoneyAmount: '0',
      propertyCity: 'Salt Lake City',
      propertyCounty: 'Salt Lake',
      propertyState: 'UT',
      propertyZip: '84105',
      propertyTaxId: '16-17-351-024',
      otherIncludedItems: 'Refrigerator, washer, dryer, smart thermostat, and mounted TV brackets',
      excludedItems: 'Seller personal property and staging items',
      purchasePrice: '725000',
      newLoanAmount: '580000',
      sellerFinancingAmount: '0',
      cashAtSettlement: '135000',
      isSubjectToSaleOfBuyersProperty: false,
      possessionTiming: 'ON_RECORDING',
      capitalImprovementsPayer: 'SELLER',
      changeOfOwnershipFeePayer: 'BUYER',
      sellerCompensationContributionPercent: '0',
      sellerCompensationContributionFlat: '5000',
      hasDueDiligenceCondition: true,
      hasAppraisalCondition: true,
      hasFinancingCondition: true,
      sellerDisclosureDeadline: daysFromNow(2),
      dueDiligenceDeadline: daysFromNow(8),
      financingAppraisalDeadline: daysFromNow(14),
      settlementDeadline: daysFromNow(27),
      hasHomeWarranty: true,
      homeWarrantyOrderedBy: 'BUYER',
      homeWarrantyMaxCost: '650',
      offerExpirationDate: daysFromNow(1),
      offerExpirationTime: '5:00',
      offerExpirationMeridiem: 'PM',
      rawJson: {
        demo: true,
        summary: 'Demo REPC packet with upcoming disclosure, due diligence, financing, and settlement dates.',
      },
    },
  });

  const envelopeName = 'Demo REPC packet - awaiting seller signature';
  const existingEnvelope = await prisma.signatureEnvelope.findFirst({
    where: { dealId: deal.id, documentName: envelopeName },
    select: { id: true },
  });
  const envelopeData = {
    agentId,
    dealId: deal.id,
    type: 'REPC' as const,
    documentVersion: 1,
    documentName: envelopeName,
    contractSnapshot: {
      demo: true,
      dealTitle,
      property: propertySeed,
      status: 'Buyer signed, seller pending',
    },
    completedAt: null,
  };
  const envelope = existingEnvelope
    ? await prisma.signatureEnvelope.update({ where: { id: existingEnvelope.id }, data: envelopeData })
    : await prisma.signatureEnvelope.create({ data: envelopeData });
  await prisma.signer.deleteMany({ where: { envelopeId: envelope.id } });
  await prisma.signer.createMany({
    data: [
      {
        envelopeId: envelope.id,
        role: 'BUYER',
        name: 'Maya Thompson',
        email: 'maya.thompson.demo@example.com',
        viewedAt: daysFromNow(-1),
        signedAt: daysFromNow(-1),
        signatureType: 'TYPED',
        signatureData: { typedName: 'Maya Thompson', demo: true },
      },
      {
        envelopeId: envelope.id,
        role: 'SELLER',
        name: 'Evan Park',
        email: 'evan.park.demo@example.com',
        viewedAt: daysFromNow(-0.5),
        signatureType: 'NONE',
      },
    ],
  });

  await Promise.all([
    ensureDemoTask({
      agentId,
      title: 'Call Maya with inspection game plan',
      description: 'Walk through due diligence dates, inspector options, and what AgentEasePro is tracking automatically.',
      category: TaskCategory.CALL,
      priority: TaskPriority.HIGH,
      bucket: TaskBucket.TODAY,
      dueAt: daysFromNow(0.25),
      dealId: deal.id,
      clientId: clients.buyerId,
    }),
    ensureDemoTask({
      agentId,
      title: 'Send seller disclosure reminder',
      description: 'Disclosure deadline is coming up. Send a friendly reminder from the contract timeline.',
      category: TaskCategory.CONTRACT,
      priority: TaskPriority.HIGH,
      bucket: TaskBucket.THIS_WEEK,
      dueAt: daysFromNow(2),
      dealId: deal.id,
      clientId: clients.sellerId,
    }),
    ensureDemoTask({
      agentId,
      title: 'Ask Jordan Lee for two referral intros',
      description: 'Use the referral CRM workflow to turn a past-client touchpoint into a warm intro.',
      category: TaskCategory.MARKETING,
      priority: TaskPriority.NORMAL,
      bucket: TaskBucket.TODAY,
      dueAt: daysFromNow(1),
      clientId: clients.referralClientId,
    }),
    ensureDemoTask({
      agentId,
      title: 'Prep closing gift for Park family',
      description: 'Add a personal note and closing gift task so the demo shows post-contract service.',
      category: TaskCategory.POPBY,
      priority: TaskPriority.NORMAL,
      bucket: TaskBucket.LATER,
      dueAt: daysFromNow(18),
      dealId: deal.id,
      clientId: clients.sellerId,
    }),
  ]);

  await prisma.dailyActivity.upsert({
    where: { agentId_date: { agentId, date: todayAsDateOnly() } },
    create: {
      agentId,
      date: todayAsDateOnly(),
      callsGoal: 5,
      callsMade: 3,
      notesGoal: 2,
      notesSent: 1,
      popbysGoal: 1,
      popbysDone: 0,
      referralsAskedGoal: 3,
      referralsAsked: 1,
    },
    update: {
      callsGoal: 5,
      callsMade: 3,
      notesGoal: 2,
      notesSent: 1,
      popbysGoal: 1,
      popbysDone: 0,
      referralsAskedGoal: 3,
      referralsAsked: 1,
    },
  });

  const landingPage = await prisma.landingPage.upsert({
    where: { slug: 'demo-sugar-house-bungalow' },
    create: {
      agentId,
      listingId: listing.id,
      slug: 'demo-sugar-house-bungalow',
      title: 'Sugar House Craftsman Open House',
      description: 'Demo landing page for a polished listing launch and lead capture workflow.',
      heroImage: listingSeed.heroImageUrl,
      templateId: 'design-67',
      isActive: true,
      totalViews: 248,
      uniqueViews: 91,
      leadsGenerated: 14,
      customContent: {
        headline: 'Tour a Sugar House Craftsman with room to grow',
        subheadline: 'Get photos, showing windows, disclosures, and a local pricing read from the listing team.',
        ctaText: 'Request a Private Showing',
        agentBio: 'Demo Agent uses AgentEasePro to capture leads, follow up fast, and keep every listing launch organized.',
      },
      customStyles: {
        primaryColor: '#d6b56d',
        secondaryColor: '#0f172a',
        heroOpacity: 0.78,
      },
    },
    update: {
      agentId,
      listingId: listing.id,
      title: 'Sugar House Craftsman Open House',
      description: 'Demo landing page for a polished listing launch and lead capture workflow.',
      heroImage: listingSeed.heroImageUrl,
      templateId: 'design-67',
      isActive: true,
      totalViews: 248,
      uniqueViews: 91,
      leadsGenerated: 14,
      customContent: {
        headline: 'Tour a Sugar House Craftsman with room to grow',
        subheadline: 'Get photos, showing windows, disclosures, and a local pricing read from the listing team.',
        ctaText: 'Request a Private Showing',
        agentBio: 'Demo Agent uses AgentEasePro to capture leads, follow up fast, and keep every listing launch organized.',
      },
      customStyles: {
        primaryColor: '#d6b56d',
        secondaryColor: '#0f172a',
        heroOpacity: 0.78,
      },
    },
  });

  const leadEmail = 'olivia.martinez.demo@example.com';
  const existingLead = await prisma.lead.findFirst({
    where: { agentId, email: leadEmail },
    select: { id: true },
  });
  const leadData = {
    clientId: null,
    listingId: listing.id,
    landingPageId: landingPage.id,
    firstName: 'Olivia',
    lastName: 'Martinez',
    email: leadEmail,
    phone: '3855550104',
    source: LeadSource.LANDING_PAGE,
    priority: LeadPriority.HOT,
    averagePrice: 750000,
    homesViewed: 3,
    lastVisit: new Date(),
    visitCount: 4,
    lastContact: daysFromNow(-1),
    nextTask: 'Send private showing windows and financing intro',
    notes: 'Demo hot lead from the Sugar House landing page. Interested in seeing the property this weekend.',
    tags: ['demo', 'landing-page', 'hot-buyer'],
  };
  if (existingLead) {
    await prisma.lead.update({ where: { id: existingLead.id }, data: leadData });
  } else {
    await prisma.lead.create({ data: { agentId, ...leadData } });
  }
}

router.post('/signup', async (req, res) => {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid signup data' });
    }

    const { email, password, name } = parsed.data;

    const result = await idSignup(email, password, name, reqCtx(req));
    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }

    try {
      const policies = await getLegalPolicies();
      if (result.agent?.id) {
        await recordAgentLegalAcceptance(result.agent.id, policies, reqCtx(req));
      }
    } catch (legalErr) {
      console.error('Failed to record legal acceptance during signup:', legalErr);
    }

    return res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      agent: result.agent,
      emailVerified: result.emailVerified ?? false,
    });
  } catch (err) {
    console.error('Signup error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/legal-policies', async (_req, res) => {
  try {
    const policies = await getLegalPolicies();
    return res.json(policies);
  } catch (err) {
    console.error('Failed to load legal policies:', err);
    return res.status(500).json({ error: 'Failed to load legal policies' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login data' });
    }

    const { email, password } = parsed.data;

    const result = await idLogin(email, password, reqCtx(req));
    if (!result.success) {
      const status = result.locked ? 423 : 401;
      return res.status(status).json({
        error: result.error,
        locked: result.locked || false,
        remainingAttempts: result.remainingAttempts,
      });
    }

    return res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      agent: result.agent,
      emailVerified: result.emailVerified ?? true,
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public demo access (production-safe): restricted to the demo account only.
router.post('/demo-login', async (req, res) => {
  const disableDemo = (process.env.DISABLE_DEMO_LOGIN || '').toLowerCase() === 'true';
  const allowDemo = (process.env.ALLOW_DEMO_LOGIN || '').toLowerCase();

  // Default behavior is enabled to support public product demos.
  // Set DISABLE_DEMO_LOGIN=true to hard-disable, or ALLOW_DEMO_LOGIN=false for legacy toggles.
  if (disableDemo || allowDemo === 'false') {
    return res.status(404).json({ error: 'Not found' });
  }

  const demoEmail = normalizeEmail(process.env.DEMO_LOGIN_EMAIL || 'demo@agentease.com');

  const agent = await prisma.agent.upsert({
    where: { email: demoEmail },
    update: {
      name: 'AgentEasePro Demo Agent',
      emailVerified: true,
      billingMode: 'STANDARD',
      billingAccessOverride: true,
      subscriptionStatus: 'ACTIVE',
    },
    create: {
      email: demoEmail,
      name: 'AgentEasePro Demo Agent',
      emailVerified: true,
      billingMode: 'STANDARD',
      billingAccessOverride: true,
      subscriptionStatus: 'ACTIVE',
    },
  });

  try {
    await ensureDemoWorkspace(agent.id);
  } catch (err) {
    console.warn('Demo workspace ensure failed:', err);
  }

  try {
    const token = signLegacyToken(agent.id);

    await auditLog({
      action: 'AUTH_DEMO_LOGIN',
      agentId: agent.id,
      email: demoEmail,
      ip: extractIp(req),
      userAgent: req.get('user-agent'),
      detail: 'Demo login',
    });

    const safeAgent = await prisma.agent.findUnique({
      where: { id: agent.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        teamId: true,
        brokerageId: true,
      },
    });

    return res.json({
      token,
      agent: safeAgent ?? {
        id: agent.id,
        email: agent.email,
        name: 'AgentEasePro Demo Agent',
        emailVerified: true,
        teamId: null,
        brokerageId: null,
      },
    });
  } catch (err) {
    console.error('JWT signing error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
});

router.post('/dev-login', async (req, res) => {
  const env = (process.env.NODE_ENV || '').toLowerCase();

  // SECURITY: Never allow dev-login in production, regardless of env vars
  if (env === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const allowDevLogin = (process.env.ALLOW_DEV_LOGIN || '').toLowerCase() === 'true';
  if (!allowDevLogin && env !== 'development' && env !== 'test') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = normalizeEmail(email);

  const agent = await prisma.agent.upsert({
    where: { email: normalizedEmail },
    update: {
      billingAccessOverride: true,
      subscriptionStatus: 'ACTIVE',
    },
    create: {
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0] || 'Agent',
      billingAccessOverride: true,
      subscriptionStatus: 'ACTIVE',
    },
  });

  try {
    const token = signLegacyToken(agent.id);

    await auditLog({
      action: 'AUTH_DEV_LOGIN',
      agentId: agent.id,
      email: normalizedEmail,
      ip: extractIp(req),
      userAgent: req.get('user-agent'),
      detail: 'Dev login',
    });

    return res.json({ token, agent });
  } catch (err) {
    console.error('JWT signing error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const result = await requestPasswordReset(email, reqCtx(req));

  // Send email if we got a token (account exists)
  if (result.resetToken && result.resetUrl) {
    const agent = await prisma.agent.findUnique({ where: { email: normalizeEmail(email) } });
    if (agent) {
      const emailResult = await sendPasswordResetEmail({
        email: agent.email,
        resetUrl: result.resetUrl,
        expiresAt: new Date(Date.now() + 3600000),
      });

      if (!emailResult.success) {
        console.warn('Password reset email failed:', emailResult.error);
      }
    }
  }

  // Always return generic success (don't reveal account existence)
  return res.json({ success: true, message: 'If that email exists, we sent reset instructions' });
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  const result = await executePasswordReset(token, password, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Password reset successful' });
});

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .strict();

router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid password payload' });
  }

  const result = await changePassword(
    req.agentId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    reqCtx(req),
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Unable to change password' });
  }

  return res.json({ success: true, message: 'Password changed successfully' });
});
// ── Token refresh (rotate access + refresh pair) ──────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const result = await refreshAccessToken(refreshToken, reqCtx(req));

  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }

  return res.json({
    token: result.token,
    refreshToken: result.refreshToken,
    agent: result.agent,
  });
});

// ── Logout (revoke refresh token) ─────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken, reqCtx(req));
  }
  return res.json({ success: true, message: 'Logged out' });
});

// ── Email Verification ────────────────────────────────────────────

// Verify email with 6-digit code (requires auth token)
router.post('/verify-email', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await verifyEmail(req.agentId, code, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, emailVerified: true });
});

// Resend verification code (requires auth token)
router.post('/resend-verification', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await resendVerificationCode(req.agentId, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Verification code sent' });
});