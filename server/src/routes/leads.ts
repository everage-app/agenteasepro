import { Router } from 'express';
import { LeadPriority, LeadSource } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const ARCHIVED_TAG = 'ARCHIVED';

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseLeadSource = (raw: unknown): LeadSource | undefined => {
  if (!raw) return undefined;
  const t = normalizeToken(String(raw));
  if (!t) return undefined;
  const asEnumKey = t.toUpperCase();
  if ((LeadSource as any)[asEnumKey]) return (LeadSource as any)[asEnumKey] as LeadSource;
  const aliases: Record<string, LeadSource> = {
    website: LeadSource.WEBSITE,
    web: LeadSource.WEBSITE,
    landing_page: LeadSource.LANDING_PAGE,
    landingpage: LeadSource.LANDING_PAGE,
    zillow: LeadSource.ZILLOW,
    realtor_com: LeadSource.REALTOR_COM,
    realtor: LeadSource.REALTOR_COM,
    facebook: LeadSource.FACEBOOK,
    fb: LeadSource.FACEBOOK,
    instagram: LeadSource.INSTAGRAM,
    ig: LeadSource.INSTAGRAM,
    google_ads: LeadSource.GOOGLE_ADS,
    google: LeadSource.GOOGLE_ADS,
    email: LeadSource.EMAIL,
    direct: LeadSource.DIRECT,
    referral: LeadSource.REFERRAL,
    referred: LeadSource.REFERRAL,
    other: LeadSource.OTHER,
  };
  return aliases[t];
};

const parseLeadPriority = (raw: unknown): LeadPriority | undefined => {
  if (!raw) return undefined;
  const t = normalizeToken(String(raw));
  if (!t) return undefined;
  const asEnumKey = t.toUpperCase();
  if ((LeadPriority as any)[asEnumKey]) return (LeadPriority as any)[asEnumKey] as LeadPriority;
  const aliases: Record<string, LeadPriority> = {
    hot: LeadPriority.HOT,
    warm: LeadPriority.WARM,
    cold: LeadPriority.COLD,
    dead: LeadPriority.DEAD,
    junk: LeadPriority.DEAD,
    lost: LeadPriority.DEAD,
  };
  return aliases[t];
};

const parseArchivedQuery = (value: unknown): 'true' | 'false' | 'all' => {
  if (value === 'true' || value === true) return 'true';
  if (value === 'all') return 'all';
  return 'false';
};

const leadCreateSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1).optional(),
    listingId: z.string().trim().min(1).optional(),
    landingPageId: z.string().trim().min(1).optional(),
    source: z.any().optional(),
    priority: z.any().optional(),
    notes: z.string().optional(),
    visitorId: z.string().trim().min(1).optional(),
    utmData: z.record(z.any()).optional(),
  })
  .strict();

const leadUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    source: z.any().optional(),
    priority: z.any().optional(),
    assignedTo: z.string().trim().min(1).nullable().optional(),
    nextTask: z.string().trim().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    converted: z.boolean().optional(),
  })
  .strict();

const leadActivityCreateSchema = z
  .object({
    type: z.enum(['NOTE', 'CALL', 'EMAIL', 'SMS', 'CUSTOM']).default('NOTE'),
    description: z.string().trim().min(1).max(5000),
  })
  .strict();

const bulkImportSchema = z
  .object({
    records: z
      .array(
        z
          .object({
            firstName: z.string().trim().min(1).max(80).optional(),
            lastName: z.string().trim().min(1).max(120).optional(),
            name: z.string().trim().min(1).max(200).optional(),
            email: z.string().trim().email(),
            phone: z.string().trim().max(40).optional(),
            source: z.any().optional(),
            priority: z.any().optional(),
            notes: z.string().trim().max(5000).optional(),
            tags: z.array(z.string().trim().min(1).max(40)).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
    skipDuplicates: z.boolean().default(false),
    defaults: z
      .object({
        source: z.any().optional(),
        priority: z.any().optional(),
      })
      .optional(),
  })
  .strict();

router.use(authenticateToken);

const normalizePhoneForClient = (phone: string | undefined | null) => {
  if (!phone) return null;
  const normalized = phone.toString().replace(/\D/g, '').slice(0, 15);
  return normalized || null;
};

// Add an activity item (notes / calls / etc) for a lead
router.post('/:id/activities', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = leadActivityCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid activity data' });
    }

    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, agentId: req.user!.id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const activityType = parsed.data.type === 'CUSTOM' ? 'NOTE' : parsed.data.type;
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: existing.id,
        activityType,
        description: parsed.data.description,
      },
    });

    await prisma.lead.update({
      where: { id: existing.id },
      data: { lastContact: new Date() },
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating lead activity:', error);
    res.status(500).json({ error: 'Failed to create lead activity' });
  }
});

// Bulk import leads (for CSV migrations)
router.post('/bulk-import', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = bulkImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid import payload' });
    }

    const agentId = req.user!.id;
    const defaults = parsed.data.defaults || {};
    const defaultSource = parseLeadSource(defaults.source) ?? LeadSource.WEBSITE;
    const defaultPriority = parseLeadPriority(defaults.priority) ?? LeadPriority.WARM;
    const skipDuplicates = parsed.data.skipDuplicates;

    const records = parsed.data.records
      .map((r) => ({
        ...r,
        email: r.email.trim().toLowerCase(),
      }))
      .filter((r) => !!r.email);

    const dedupedByEmail = new Map<string, typeof records[number]>();
    for (const r of records) dedupedByEmail.set(r.email, r);
    const unique = Array.from(dedupedByEmail.values());

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const CHUNK = 500;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      const emails = chunk.map((c) => c.email);

      const existing = await prisma.lead.findMany({
        where: { agentId, email: { in: emails } },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, source: true, priority: true, notes: true, tags: true },
      });

      const existingByEmail = new Map(existing.map((e) => [e.email.toLowerCase(), e] as const));

      const toCreate: any[] = [];
      const toUpdate: Array<{ id: string; data: any }> = [];

      for (const r of chunk) {
        const source = parseLeadSource(r.source) ?? defaultSource;
        const priority = parseLeadPriority(r.priority) ?? defaultPriority;

        let firstName = r.firstName?.trim() || '';
        let lastName = r.lastName?.trim() || '';
        if ((!firstName || !lastName) && r.name) {
          const parts = r.name.trim().split(' ').filter(Boolean);
          firstName = firstName || parts[0] || 'Lead';
          lastName = lastName || parts.slice(1).join(' ') || 'Imported';
        }
        if (!firstName) firstName = 'Lead';
        if (!lastName) lastName = 'Imported';

        const normalizedPhone = r.phone?.trim() || undefined;
        const normalizedNotes = r.notes?.trim() || undefined;
        const normalizedTags = (r.tags || []).filter(Boolean);

        const existingLead = existingByEmail.get(r.email);
        if (existingLead) {
          if (skipDuplicates) {
            result.skipped += 1;
            continue;
          }

          const nextData: any = {};
          if (!existingLead.firstName && firstName) nextData.firstName = firstName;
          if (!existingLead.lastName && lastName) nextData.lastName = lastName;
          if (!existingLead.phone && normalizedPhone) nextData.phone = normalizedPhone;

          // If the incoming source/priority look more informative than defaults, keep them.
          if (r.source) nextData.source = source;
          if (r.priority) nextData.priority = priority;

          if (normalizedTags.length > 0) {
            nextData.tags = Array.from(new Set([...(existingLead.tags || []), ...normalizedTags]));
          }

          if (normalizedNotes) {
            nextData.notes = existingLead.notes ? `${existingLead.notes}\n\n${normalizedNotes}` : normalizedNotes;
          }

          if (Object.keys(nextData).length === 0) {
            result.skipped += 1;
            continue;
          }

          toUpdate.push({ id: existingLead.id, data: nextData });
          continue;
        }

        toCreate.push({
          agentId,
          firstName,
          lastName,
          email: r.email,
          phone: normalizedPhone,
          source,
          priority,
          notes: normalizedNotes,
          tags: normalizedTags,
          lastVisit: new Date(),
          visitCount: 1,
        });
      }

      if (toCreate.length > 0) {
        await prisma.lead.createMany({ data: toCreate, skipDuplicates: true });
        result.created += toCreate.length;
      }

      if (toUpdate.length > 0) {
        // Keep transactions small
        const updateTx = toUpdate.map((u) => prisma.lead.update({ where: { id: u.id }, data: u.data }));
        await prisma.$transaction(updateTx);
        result.updated += toUpdate.length;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error bulk importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// Get all leads with comprehensive analytics
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { listingId, priority, source, converted, search } = req.query;
    const archived = parseArchivedQuery(req.query.archived);

    // Pagination: ?page=1&limit=50 (defaults: page 1, limit 50, max 200)
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      agentId: req.user!.id,
      listingId: listingId as string | undefined,
      priority: priority as any,
      source: source as any,
      converted: converted === 'true' ? true : converted === 'false' ? false : undefined,
      OR: search
        ? [
            { firstName: { contains: search as string, mode: 'insensitive' } },
            { lastName: { contains: search as string, mode: 'insensitive' } },
            { email: { contains: search as string, mode: 'insensitive' } },
            { phone: { contains: search as string, mode: 'insensitive' } },
          ]
        : undefined,
    };

    if (archived === 'true') {
      where.tags = { has: ARCHIVED_TAG };
    } else if (archived === 'false') {
      where.NOT = [{ tags: { has: ARCHIVED_TAG } }];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
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
          landingPage: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { priority: 'asc' },
          { lastVisit: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Backward-compatible: return raw array when no page param, paginated envelope when page is explicit
    if (req.query.page) {
      res.json({ data: leads, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } else {
      res.json(leads);
    }
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Archive a lead (kept for historical tracking)
router.post('/:id/archive', async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, agentId: req.user!.id },
      select: { id: true, tags: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const nextTags = Array.from(new Set([...(existing.tags ?? []), ARCHIVED_TAG]));

    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { tags: nextTags },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'ARCHIVED',
        description: 'Lead archived',
      },
    });

    res.json(lead);
  } catch (error) {
    console.error('Error archiving lead:', error);
    res.status(500).json({ error: 'Failed to archive lead' });
  }
});

// Unarchive a lead
router.post('/:id/unarchive', async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, agentId: req.user!.id },
      select: { id: true, tags: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const nextTags = (existing.tags ?? []).filter((t) => t !== ARCHIVED_TAG);

    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { tags: nextTags },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'UNARCHIVED',
        description: 'Lead unarchived',
      },
    });

    res.json(lead);
  } catch (error) {
    console.error('Error unarchiving lead:', error);
    res.status(500).json({ error: 'Failed to unarchive lead' });
  }
});

// Convert a lead into a client (creates a Client record + links lead.clientId)
router.post('/:id/convert', async (req: AuthenticatedRequest, res) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, agentId: req.user!.id },
      include: { client: true },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Idempotent: if already linked to a client, return that client.
    if (lead.clientId && lead.client) {
      return res.json({ lead, client: lead.client });
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          agentId: lead.agentId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email?.trim().toLowerCase() || undefined,
          phone: normalizePhoneForClient(lead.phone) || undefined,
          leadSource: lead.source,
          notes: lead.notes || undefined,
          tags: lead.tags || [],
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          clientId: client.id,
          converted: true,
          convertedAt: new Date(),
          lastContact: new Date(),
        },
        include: { client: true, listing: true, landingPage: true },
      });

      await tx.leadActivity.create({
        data: {
          leadId: updatedLead.id,
          activityType: 'CONVERTED',
          description: 'Lead converted to client',
          metadata: { clientId: client.id },
        },
      });

      return { lead: updatedLead, client };
    });

    res.json(result);
  } catch (error) {
    console.error('Error converting lead to client:', error);
    res.status(500).json({ error: 'Failed to convert lead to client' });
  }
});

// Get lead by ID with full activity history
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id,
      },
      include: {
        listing: true,
        landingPage: true,
        client: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get page views for this lead
    const pageViews = await prisma.pageView.findMany({
      where: {
        OR: [
          { landingPageId: lead.landingPageId || undefined },
          { listingId: lead.listingId || undefined },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const formFeed: Array<{
      id: string;
      kind: 'ESIGN_ENVELOPE' | 'FORM_INSTANCE';
      title: string;
      status: string;
      sentAt: string | null;
      signedAt: string | null;
      updatedAt: string;
      dealId: string;
      dealTitle: string;
      propertyAddress: string | null;
      formCode: string | null;
      signerSummary?: {
        total: number;
        signed: number;
        viewed: number;
      };
      downloadUrl?: string | null;
    }> = [];

    const seenEnvelopeIds = new Set<string>();
    const seenFormInstanceIds = new Set<string>();

    if (lead.clientId) {
      const relatedDeals = await prisma.deal.findMany({
        where: {
          agentId: req.user!.id,
          OR: [{ buyerId: lead.clientId }, { sellerId: lead.clientId }],
        },
        include: {
          property: true,
          forms: {
            include: { definition: true },
            orderBy: { updatedAt: 'desc' },
          },
          signatureEnvelopes: {
            include: { signers: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      relatedDeals.forEach((deal) => {
        const propertyAddress = deal.property
          ? `${deal.property.street}, ${deal.property.city}`
          : null;

        deal.signatureEnvelopes.forEach((envelope) => {
          if (seenEnvelopeIds.has(envelope.id)) return;
          seenEnvelopeIds.add(envelope.id);

          const totalSigners = envelope.signers.length;
          const signedCount = envelope.signers.filter((s) => !!s.signedAt).length;
          const viewedCount = envelope.signers.filter((s) => !!s.viewedAt).length;
          const latestSignedAt = envelope.signers
            .map((s) => s.signedAt)
            .filter((value): value is Date => !!value)
            .sort((a, b) => b.getTime() - a.getTime())[0] || null;

          const envelopeStatus = envelope.completedAt || (totalSigners > 0 && signedCount === totalSigners)
            ? 'SIGNED'
            : signedCount > 0
              ? 'PARTIALLY_SIGNED'
              : viewedCount > 0
                ? 'VIEWED'
                : 'SENT';

          formFeed.push({
            id: envelope.id,
            kind: 'ESIGN_ENVELOPE',
            title: `${envelope.type} Signature Packet`,
            status: envelopeStatus,
            sentAt: envelope.createdAt.toISOString(),
            signedAt: (envelope.completedAt || latestSignedAt)?.toISOString() || null,
            updatedAt: (envelope.completedAt || latestSignedAt || envelope.createdAt).toISOString(),
            dealId: deal.id,
            dealTitle: deal.title,
            propertyAddress,
            formCode: envelope.type,
            signerSummary: {
              total: totalSigners,
              signed: signedCount,
              viewed: viewedCount,
            },
            downloadUrl: `/esign/envelopes/${envelope.id}/pdf`,
          });
        });

        deal.forms.forEach((form) => {
          if (seenFormInstanceIds.has(form.id)) return;
          seenFormInstanceIds.add(form.id);

          formFeed.push({
            id: form.id,
            kind: 'FORM_INSTANCE',
            title: form.title || form.definition.displayName,
            status: String(form.status || 'DRAFT').toUpperCase(),
            sentAt: null,
            signedAt: null,
            updatedAt: form.updatedAt.toISOString(),
            dealId: deal.id,
            dealTitle: deal.title,
            propertyAddress,
            formCode: form.definition.code,
          });
        });
      });
    } else if (lead.email) {
      const normalizedEmail = lead.email.trim().toLowerCase();
      const relatedEnvelopes = await prisma.signatureEnvelope.findMany({
        where: {
          deal: { agentId: req.user!.id },
          signers: {
            some: {
              OR: [{ email: normalizedEmail }, { email: lead.email }],
            },
          },
        },
        include: {
          signers: true,
          deal: {
            include: {
              property: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      relatedEnvelopes.forEach((envelope) => {
        if (seenEnvelopeIds.has(envelope.id)) return;
        seenEnvelopeIds.add(envelope.id);

        const totalSigners = envelope.signers.length;
        const signedCount = envelope.signers.filter((s) => !!s.signedAt).length;
        const viewedCount = envelope.signers.filter((s) => !!s.viewedAt).length;
        const latestSignedAt = envelope.signers
          .map((s) => s.signedAt)
          .filter((value): value is Date => !!value)
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;

        const envelopeStatus = envelope.completedAt || (totalSigners > 0 && signedCount === totalSigners)
          ? 'SIGNED'
          : signedCount > 0
            ? 'PARTIALLY_SIGNED'
            : viewedCount > 0
              ? 'VIEWED'
              : 'SENT';

        formFeed.push({
          id: envelope.id,
          kind: 'ESIGN_ENVELOPE',
          title: `${envelope.type} Signature Packet`,
          status: envelopeStatus,
          sentAt: envelope.createdAt.toISOString(),
          signedAt: (envelope.completedAt || latestSignedAt)?.toISOString() || null,
          updatedAt: (envelope.completedAt || latestSignedAt || envelope.createdAt).toISOString(),
          dealId: envelope.deal.id,
          dealTitle: envelope.deal.title,
          propertyAddress: envelope.deal.property
            ? `${envelope.deal.property.street}, ${envelope.deal.property.city}`
            : null,
          formCode: envelope.type,
          signerSummary: {
            total: totalSigners,
            signed: signedCount,
            viewed: viewedCount,
          },
          downloadUrl: `/esign/envelopes/${envelope.id}/pdf`,
        });
      });
    }

    formFeed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json({ ...lead, pageViews, forms: formFeed });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead (from landing page form submission)
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = leadCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid lead data' });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      listingId,
      landingPageId,
      source,
      priority,
      notes,
      visitorId,
      utmData,
    } = parsed.data;

    const parsedSource = parseLeadSource(source) ?? LeadSource.WEBSITE;
    const parsedPriority = parseLeadPriority(priority) ?? LeadPriority.WARM;

    // Check if lead already exists
    const existingLead = await prisma.lead.findFirst({
      where: {
        agentId: req.user!.id,
        email: email.toLowerCase(),
      },
    });

    if (existingLead) {
      // Update existing lead
      const updated = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          visitCount: { increment: 1 },
          lastVisit: new Date(),
          priority: parsedPriority || existingLead.priority,
          notes: notes ? `${existingLead.notes || ''}\n\n${notes}` : existingLead.notes,
        },
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId: updated.id,
          activityType: 'RETURN_VISIT',
          listingId,
          description: 'Returned to view listing',
          metadata: utmData || {},
        },
      });

      return res.json(updated);
    }

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        agentId: req.user!.id,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        listingId,
        landingPageId,
        source: parsedSource,
        priority: parsedPriority,
        notes,
        visitCount: 1,
        lastVisit: new Date(),
      },
    });

    // Log initial activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'LEAD_CREATED',
        listingId,
        description: 'New lead captured',
        metadata: utmData || {},
      },
    });

    // Update landing page stats
    if (landingPageId) {
      await prisma.landingPage.update({
        where: { id: landingPageId },
        data: { leadsGenerated: { increment: 1 } },
      });
    }

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = leadUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid lead update data' });
    }

    const { firstName, lastName, email, phone, source, priority, assignedTo, nextTask, notes, tags, converted } = parsed.data;

    const parsedSource = parseLeadSource(source);
    const parsedPriority = parseLeadPriority(priority);

    const existing = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email: email.toLowerCase() }),
        ...(phone !== undefined && { phone }),
        ...(parsedSource !== undefined && { source: parsedSource }),
        ...(parsedPriority !== undefined && { priority: parsedPriority }),
        assignedTo,
        nextTask,
        notes,
        tags,
        converted,
        convertedAt: converted ? new Date() : null,
        lastContact: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: converted ? 'CONVERTED' : 'UPDATED',
        description: converted ? 'Lead converted to client' : 'Lead information updated',
      },
    });

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete lead
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await prisma.$transaction([
      prisma.leadActivity.deleteMany({ where: { leadId: existing.id } }),
      prisma.savedListing.deleteMany({ where: { leadId: existing.id } }),
      prisma.searchCriteria.deleteMany({ where: { leadId: existing.id } }),
      prisma.lead.delete({ where: { id: existing.id } }),
    ]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Merge two leads (source into target)
router.post('/merge', async (req: AuthenticatedRequest, res) => {
  const { sourceId, targetId } = req.body || {};

  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'sourceId and targetId are required' });
  }

  if (sourceId === targetId) {
    return res.status(400).json({ error: 'Cannot merge a lead into itself' });
  }

  try {
    const [source, target] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: sourceId, agentId: req.user!.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          priority: true,
          averagePrice: true,
          homesViewed: true,
          lastVisit: true,
          visitCount: true,
          lastContact: true,
          nextTask: true,
          assignedTo: true,
          notes: true,
          tags: true,
          converted: true,
          convertedAt: true,
          clientId: true,
        },
      }),
      prisma.lead.findFirst({
        where: { id: targetId, agentId: req.user!.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          priority: true,
          averagePrice: true,
          homesViewed: true,
          lastVisit: true,
          visitCount: true,
          lastContact: true,
          nextTask: true,
          assignedTo: true,
          notes: true,
          tags: true,
          converted: true,
          convertedAt: true,
          clientId: true,
        },
      }),
    ]);

    if (!source) {
      return res.status(404).json({ error: 'Source lead not found' });
    }
    if (!target) {
      return res.status(404).json({ error: 'Target lead not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.leadActivity.updateMany({
        where: { leadId: sourceId },
        data: { leadId: targetId },
      });

      await tx.savedListing.updateMany({
        where: { leadId: sourceId },
        data: { leadId: targetId },
      });

      await tx.searchCriteria.updateMany({
        where: { leadId: sourceId },
        data: { leadId: targetId },
      });

      const mergedTags = [...new Set([...(target.tags || []), ...(source.tags || [])])];
      const mergedNotes = target.notes
        ? `${target.notes}\n\n[Merged from ${source.firstName} ${source.lastName}]: ${source.notes || ''}`
        : source.notes;

      const mergedHomesViewed = (target.homesViewed || 0) + (source.homesViewed || 0);
      const mergedVisitCount = (target.visitCount || 0) + (source.visitCount || 0);
      const mergedLastVisit =
        target.lastVisit && source.lastVisit
          ? new Date(Math.max(target.lastVisit.getTime(), source.lastVisit.getTime()))
          : target.lastVisit || source.lastVisit || null;
      const mergedLastContact =
        target.lastContact && source.lastContact
          ? new Date(Math.max(target.lastContact.getTime(), source.lastContact.getTime()))
          : target.lastContact || source.lastContact || null;

      await tx.lead.update({
        where: { id: targetId },
        data: {
          tags: mergedTags,
          notes: mergedNotes,
          phone: target.phone || source.phone,
          source: target.source || source.source,
          priority: target.priority || source.priority,
          averagePrice: target.averagePrice || source.averagePrice,
          homesViewed: mergedHomesViewed,
          visitCount: mergedVisitCount,
          lastVisit: mergedLastVisit,
          lastContact: mergedLastContact,
          nextTask: target.nextTask || source.nextTask,
          assignedTo: target.assignedTo || source.assignedTo,
          converted: target.converted || source.converted,
          convertedAt: target.convertedAt || source.convertedAt,
          clientId: target.clientId || source.clientId,
        },
      });

      await tx.lead.delete({ where: { id: sourceId } });
    });

    return res.json({
      success: true,
      message: `Merged ${source.firstName} ${source.lastName} into ${target.firstName} ${target.lastName}`,
      targetId,
    });
  } catch (error) {
    console.error('Error merging leads:', error);
    return res.status(500).json({ error: 'Failed to merge leads' });
  }
});

// Get lead analytics summary
router.get('/analytics/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate, listingId } = req.query;
    const archived = parseArchivedQuery(req.query.archived);

    const where: any = { agentId: req.user!.id };

    if (archived === 'true') {
      where.tags = { has: ARCHIVED_TAG };
    } else if (archived === 'false') {
      where.NOT = [{ tags: { has: ARCHIVED_TAG } }];
    }

    if (listingId) {
      where.listingId = listingId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      convertedLeads,
      sourceBreakdown,
      recentLeads,
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, priority: 'HOT' } }),
      prisma.lead.count({ where: { ...where, priority: 'WARM' } }),
      prisma.lead.count({ where: { ...where, priority: 'COLD' } }),
      prisma.lead.count({ where: { ...where, converted: true } }),
      prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          listing: {
            select: {
              addressLine1: true,
              city: true,
            },
          },
        },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    res.json({
      summary: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        convertedLeads,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
      },
      sourceBreakdown,
      recentLeads,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get integration source label breakdown (tags prefixed with SOURCE:)
router.get('/analytics/integration-sources', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leads = await prisma.lead.findMany({
      where: { agentId: req.user!.id, createdAt: { gte: since } },
      select: { tags: true, source: true },
    });

    const sourceLabelCounts: Record<string, number> = {};
    const leadSourceCounts: Record<string, number> = {};

    for (const lead of leads) {
      const sourceKey = lead.source || 'UNKNOWN';
      leadSourceCounts[sourceKey] = (leadSourceCounts[sourceKey] || 0) + 1;

      for (const tag of lead.tags || []) {
        if (!tag.startsWith('SOURCE:')) continue;
        const label = tag.replace(/^SOURCE:/, '');
        sourceLabelCounts[label] = (sourceLabelCounts[label] || 0) + 1;
      }
    }

    const sourceLabels = Object.entries(sourceLabelCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const leadSources = Object.entries(leadSourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ days, sourceLabels, leadSources });
  } catch (error) {
    console.error('Error fetching integration sources:', error);
    res.status(500).json({ error: 'Failed to fetch integration sources' });
  }
});

// Track page view (called from landing pages)
router.post('/track/view', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      landingPageId,
      listingId,
      visitorId,
      ipAddress,
      userAgent,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      duration,
      location,
    } = req.body;

    const pageView = await prisma.pageView.create({
      data: {
        landingPageId,
        listingId,
        visitorId,
        ipAddress,
        userAgent,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        duration,
        country: location?.country,
        city: location?.city,
        region: location?.region,
        device: location?.device,
        browser: location?.browser,
      },
    });

    // Update landing page view counts
    if (landingPageId) {
      // Check if this visitor has already been counted
      const existingView = await prisma.pageView.findFirst({
        where: {
          landingPageId,
          visitorId,
          id: { not: pageView.id }, // Exclude the view we just created
        },
      });

      await prisma.landingPage.update({
        where: { id: landingPageId },
        data: {
          totalViews: { increment: 1 },
          ...(existingView ? {} : { uniqueViews: { increment: 1 } }),
        },
      });
    }

    res.json(pageView);
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

export default router;
