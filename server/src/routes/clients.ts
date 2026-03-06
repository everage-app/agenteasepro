import { Router } from 'express';
import { ClientStage, ClientRole, Prisma, ClientTemperature } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { dispatchAutomationEvent } from '../automation/runner';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
export const router = Router();

const CreateClientSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.nativeEnum(ClientRole).optional(),
  stage: z.nativeEnum(ClientStage).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  source: z.string().trim().max(80).nullable().optional(),
  referralRank: z.enum(['A', 'B', 'C']).optional(),
  temperature: z.nativeEnum(ClientTemperature).optional(),
  mailingAddress: z.string().trim().max(200).nullable().optional(),
  mailingCity: z.string().trim().max(100).nullable().optional(),
  mailingState: z.string().trim().max(50).nullable().optional(),
  mailingZip: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  birthday: z.string().trim().nullable().optional(),
});

const CreateClientNoteSchema = z
  .object({
    text: z.string().trim().min(1).max(5000),
  })
  .strict();

/**
 * GET /api/clients
 * Get all clients with enriched data
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { stage, search } = req.query;

    // Pagination: ?page=1&limit=50 (defaults: page 1, limit 50, max 200)
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      agentId: req.agentId,
      ...(stage && { stage: stage as ClientStage }),
      ...(search && {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const clients = await prisma.client.findMany({
      where,
      include: {
        buyerDeals: {
          include: {
            property: true,
            repc: true,
          },
        },
        sellerDeals: {
          include: {
            property: true,
            repc: true,
          },
        },
        tasks: {
          where: { status: 'OPEN' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.client.count({ where });

    // Enrich with computed fields
    const enrichedClients = clients.map(client => {
      const allDeals = [...client.buyerDeals, ...client.sellerDeals];
      const activeDeals = allDeals.filter(d => !['CLOSED', 'FELL_THROUGH'].includes(d.status));
      const primaryDeal = activeDeals[0] || allDeals[0]; // Most recent active or just most recent

      // Find next deadline across all deals
      let nextDeadline: Date | null = null;
      for (const deal of activeDeals) {
        if (deal.repc) {
          const deadlines = [
            deal.repc.sellerDisclosureDeadline,
            deal.repc.dueDiligenceDeadline,
            deal.repc.financingAppraisalDeadline,
            deal.repc.settlementDeadline,
          ].filter(Boolean) as Date[];
          
          const upcomingDeadlines = deadlines.filter(d => d > new Date());
          if (upcomingDeadlines.length > 0) {
            const earliest = upcomingDeadlines.sort((a, b) => a.getTime() - b.getTime())[0];
            if (!nextDeadline || earliest < nextDeadline) {
              nextDeadline = earliest;
            }
          }
        }
      }

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
        stage: client.stage,
        role: client.role,
        tags: client.tags,
        referralRank: client.referralRank,
        referralsGiven: client.referralsGiven,
        referralsClosed: client.referralsClosed,
        primaryProperty: primaryDeal?.property ? `${primaryDeal.property.street}, ${primaryDeal.property.city}` : undefined,
        primaryDealStage: primaryDeal?.status,
        nextDeadline: nextDeadline?.toISOString() || null,
        openTasksCount: client.tasks.length,
        dealCount: allDeals.length,
        lastContactAt: client.lastContactAt?.toISOString() || null,
        lastMarketingAt: client.lastMarketingAt?.toISOString() || null,
        temperature: client.temperature,
        createdAt: client.createdAt.toISOString(),
      };
    });

    // Backward-compatible: return raw array when no page param, paginated envelope when page is explicit
    if (req.query.page) {
      res.json({ data: enrichedClients, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } else {
      res.json(enrichedClients);
    }
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * GET /api/clients/stats
 * Returns metrics for the top cards
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const clients = await prisma.client.findMany({
      where: { agentId: req.agentId },
      include: {
        tasks: { where: { status: 'OPEN' } },
        buyerDeals: { include: { repc: true } },
        sellerDeals: { include: { repc: true } },
      },
    });

    const totalClients = clients.length;
    const activeOrUnderContract = clients.filter(c => 
      ['ACTIVE', 'UNDER_CONTRACT'].includes(c.stage)
    ).length;
    const openTaskClients = clients.filter(c => c.tasks.length > 0).length;

    let upcomingDeadlineClients = 0;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    for (const client of clients) {
      const allDeals = [...client.buyerDeals, ...client.sellerDeals];
      const activeDeals = allDeals.filter(d => !['CLOSED', 'FELL_THROUGH'].includes(d.status));
      
      let hasUpcoming = false;
      for (const deal of activeDeals) {
        if (deal.repc) {
          const deadlines = [
            deal.repc.sellerDisclosureDeadline,
            deal.repc.dueDiligenceDeadline,
            deal.repc.financingAppraisalDeadline,
            deal.repc.settlementDeadline,
          ].filter(Boolean) as Date[];
          
          if (deadlines.some(d => d > now && d <= thirtyDaysFromNow)) {
            hasUpcoming = true;
            break;
          }
        }
      }
      if (hasUpcoming) upcomingDeadlineClients++;
    }

    res.json({
      totalClients,
      activeOrUnderContract,
      openTaskClients,
      upcomingDeadlineClients,
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({ error: 'Failed to fetch client stats' });
  }
});

/**
 * GET /api/clients/:id
 * Get a single client with full details (Client 360)
 */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: {
        id,
        agentId: req.agentId,
      },
      include: {
        buyerDeals: {
          include: {
            property: true,
            repc: true,
            events: { orderBy: { date: 'asc' } },
            forms: {
              include: { definition: true },
              orderBy: { updatedAt: 'desc' },
            },
            signatureEnvelopes: {
              include: { signers: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        sellerDeals: {
          include: {
            property: true,
            repc: true,
            events: { orderBy: { date: 'asc' } },
            forms: {
              include: { definition: true },
              orderBy: { updatedAt: 'desc' },
            },
            signatureEnvelopes: {
              include: { signers: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        tasks: {
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const allDeals = [...client.buyerDeals, ...client.sellerDeals];
    
    const deals = allDeals.map(deal => {
      // Calculate next deadline
      let nextDeadline: Date | null = null;
      if (deal.repc) {
        const deadlines = [
          deal.repc.sellerDisclosureDeadline,
          deal.repc.dueDiligenceDeadline,
          deal.repc.financingAppraisalDeadline,
          deal.repc.settlementDeadline,
        ].filter(Boolean) as Date[];
        const upcoming = deadlines.filter(d => d > new Date()).sort((a, b) => a.getTime() - b.getTime());
        if (upcoming.length > 0) nextDeadline = upcoming[0];
      }

      return {
        id: deal.id,
        title: deal.title,
        address: deal.property ? `${deal.property.street}, ${deal.property.city}` : undefined,
        stage: deal.status,
        primaryFormCode: 'REPC', // Placeholder
        nextDeadline: nextDeadline?.toISOString() || null,
      };
    });

    const tasks = client.tasks.map(task => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt?.toISOString() || null,
      status: task.status,
    }));

    // Timeline construction
    const timeline: any[] = [];
    
    // Add tasks to timeline
    client.tasks.forEach(task => {
      if (task.status === 'DONE' || task.status === 'COMPLETED') {
        timeline.push({
          id: task.id,
          type: 'task',
          at: task.updatedAt.toISOString(),
          label: task.category === 'NOTE' ? `Note: ${task.title}` : `Completed task: ${task.title}`,
          meta: task.category === 'NOTE' ? { category: task.category, description: task.description } : undefined,
        });
      }
    });

    // Add deal events to timeline
    allDeals.forEach(deal => {
      deal.events.forEach(event => {
        timeline.push({
          id: event.id,
          type: 'deal',
          at: event.date.toISOString(),
          label: event.title,
          meta: { dealId: deal.id, dealTitle: deal.title },
        });
      });
      // Add creation event
      timeline.push({
        id: `create-${deal.id}`,
        type: 'deal',
        at: deal.createdAt.toISOString(),
        label: `Deal started: ${deal.title}`,
        meta: { dealId: deal.id },
      });
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

    allDeals.forEach((deal) => {
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

    formFeed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Sort timeline desc
    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      client,
      deals,
      tasks,
      marketing: {
        blasts: [], // Placeholder as per discussion
        lastContactAt: client.lastContactAt?.toISOString() || null,
      },
      forms: formFeed,
      timeline,
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

/**
 * POST /api/clients/:id/notes
 * Create a note entry for a client (stored as a completed NOTE task to appear in the timeline)
 */
router.post('/:id/notes', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const parsed = CreateClientNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid note' });
    }

    const client = await prisma.client.findFirst({
      where: { id: req.params.id, agentId: req.agentId },
      select: { id: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const text = parsed.data.text.trim();
    const title = text.length > 80 ? `${text.slice(0, 77)}...` : text;

    const task = await prisma.task.create({
      data: {
        agentId: req.agentId,
        clientId: client.id,
        title,
        description: text,
        category: 'NOTE',
        status: 'DONE',
        bucket: 'DONE',
        createdFrom: 'MANUAL',
      },
    });

    await prisma.client.update({
      where: { id: client.id },
      data: { lastContactAt: new Date() },
    });

    res.status(201).json({ id: task.id });
  } catch (error) {
    console.error('Error creating client note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

/**
 * POST /api/clients
 * Create a single client
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const parsed = CreateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return res.status(400).json({ error: firstIssue?.message || 'Invalid client data' });
    }

    const { name, firstName, lastName, email, phone, role, stage, tags, source, referralRank, notes, temperature, mailingAddress, mailingCity, mailingState, mailingZip, birthday } = parsed.data;

    let finalFirstName = firstName;
    let finalLastName = lastName;

    if (!finalFirstName && name) {
      const parts = name.trim().split(' ');
      finalFirstName = parts[0];
      finalLastName = parts.slice(1).join(' ') || '';
    }

    if (!finalFirstName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const normalizedPhone = phone
      ? phone
          .toString()
          .replace(/\D/g, '')
          .slice(0, 15) || null
      : null;

    const client = await prisma.client.create({
      data: {
        agentId: req.agentId,
        firstName: finalFirstName,
        lastName: finalLastName || '',
        email: normalizedEmail,
        phone: normalizedPhone,
        role: (role as ClientRole) || ClientRole.BUYER,
        leadSource: source,
        stage: (stage as ClientStage) || ClientStage.NEW_LEAD,
        temperature: (temperature as ClientTemperature) || ClientTemperature.COLD,
        tags: tags || [],
        referralRank: referralRank ?? undefined,
        notes: notes ?? undefined,
        mailingAddress,
        mailingCity,
        mailingState,
        mailingZip,
        birthday: birthday ? new Date(birthday) : undefined,
      },
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'A client with this value already exists' });
      }
    }
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * POST /api/clients/bulk-import
 */
router.post('/bulk-import', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { records } = req.body as { records: any[] };
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
      const { firstName, lastName, name, email, phone, stage, role, source, tags } = record;

      // Normalize name
      let fName = firstName;
      let lName = lastName;
      if (!fName && name) {
        const parts = name.trim().split(' ');
        fName = parts[0];
        lName = parts.slice(1).join(' ') || '';
      }

      if (!fName && !email) {
        skipped++;
        continue;
      }

      // Normalize stage/role if needed (simple mapping or default)
      // Assuming frontend sends valid enum values or we default
      const validStage = Object.values(ClientStage).includes(stage) ? stage : ClientStage.NEW_LEAD;
      const validRole = Object.values(ClientRole).includes(role) ? role : ClientRole.BUYER;

      if (email) {
        // Upsert
        const existing = await prisma.client.findFirst({
          where: { agentId: req.agentId, email },
        });

        if (existing) {
          await prisma.client.update({
            where: { id: existing.id },
            data: {
              firstName: fName || existing.firstName,
              lastName: lName || existing.lastName,
              phone: phone || existing.phone,
              leadSource: source || existing.leadSource,
              tags: tags ? [...new Set([...existing.tags, ...tags])] : existing.tags,
            },
          });
          updated++;
        } else {
          await prisma.client.create({
            data: {
              agentId: req.agentId,
              firstName: fName || 'Unknown',
              lastName: lName || '',
              email,
              phone,
              stage: validStage,
              role: validRole,
              leadSource: source,
              tags: tags || [],
            },
          });
          created++;
        }
      } else {
        // Create if no email (can't dedup easily without email, maybe phone?)
        // For now, just create.
        await prisma.client.create({
          data: {
            agentId: req.agentId,
            firstName: fName || 'Unknown',
            lastName: lName || '',
            phone,
            stage: validStage,
            role: validRole,
            leadSource: source,
            tags: tags || [],
          },
        });
        created++;
      }
    }

    res.json({ created, updated, skipped });
  } catch (error) {
    console.error('Error importing clients:', error);
    res.status(500).json({ error: 'Failed to import clients' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { firstName, lastName, email, phone, role, leadSource, stage, tags, referralRank, notes, temperature, mailingAddress, mailingCity, mailingState, mailingZip, birthday } = req.body;

  const existing = await prisma.client.findFirst({
    where: { id, agentId: req.agentId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Detect stage change for automation
  const stageChanged = stage !== undefined && stage !== existing.stage;
  const oldStage = existing.stage;

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(role !== undefined && { role: role as ClientRole }),
      ...(leadSource !== undefined && { leadSource }),
      ...(stage !== undefined && { stage: stage as ClientStage }),
      ...(temperature !== undefined && { temperature: temperature as ClientTemperature }),
      ...(tags !== undefined && { tags }),
      ...(referralRank !== undefined && { referralRank }),
      ...(notes !== undefined && { notes }),
      ...(mailingAddress !== undefined && { mailingAddress }),
      ...(mailingCity !== undefined && { mailingCity }),
      ...(mailingState !== undefined && { mailingState }),
      ...(mailingZip !== undefined && { mailingZip }),
      ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
    },
  });

  // Trigger automation on stage change
  if (stageChanged) {
    dispatchAutomationEvent({
      type: 'CLIENT_STAGE_CHANGED',
      clientId: client.id,
      agentId: req.agentId,
      fromStage: oldStage,
      toStage: client.stage,
    }).catch(err => console.error('Automation dispatch failed:', err));
  }

  res.json(client);
});

/**
 * POST /api/clients/merge
 * Merge one client into another (source is deleted, target keeps all data)
 */
router.post('/merge', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { sourceId, targetId } = req.body;

  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'sourceId and targetId are required' });
  }

  if (sourceId === targetId) {
    return res.status(400).json({ error: 'Cannot merge a client into itself' });
  }

  try {
    // Verify both clients exist and belong to this agent
    const [source, target] = await Promise.all([
      prisma.client.findFirst({
        where: { id: sourceId, agentId: req.agentId },
        include: { 
          buyerDeals: true, 
          sellerDeals: true, 
          tasks: true,
        },
      }),
      prisma.client.findFirst({
        where: { id: targetId, agentId: req.agentId },
      }),
    ]);

    if (!source) {
      return res.status(404).json({ error: 'Source client not found' });
    }
    if (!target) {
      return res.status(404).json({ error: 'Target client not found' });
    }

    // Transfer all relationships from source to target
    await prisma.$transaction(async (tx) => {
      // Transfer deals where source is buyer
      await tx.deal.updateMany({
        where: { buyerId: sourceId },
        data: { buyerId: targetId },
      });

      // Transfer deals where source is seller
      await tx.deal.updateMany({
        where: { sellerId: sourceId },
        data: { sellerId: targetId },
      });

      // Transfer tasks
      await tx.task.updateMany({
        where: { clientId: sourceId },
        data: { clientId: targetId },
      });

      // Merge tags (combine unique tags)
      const sourceTags = source.tags || [];
      const targetTags = target.tags || [];
      const mergedTags = [...new Set([...targetTags, ...sourceTags])];

      // Update target with merged tags and fill in missing data from source
      await tx.client.update({
        where: { id: targetId },
        data: {
          tags: mergedTags,
          // Fill in missing fields from source
          email: target.email || source.email,
          phone: target.phone || source.phone,
          notes: target.notes 
            ? `${target.notes}\n\n[Merged from ${source.firstName} ${source.lastName}]: ${source.notes || ''}`
            : source.notes,
        },
      });

      // Delete the source client
      await tx.client.delete({
        where: { id: sourceId },
      });
    });

    res.json({ 
      success: true, 
      message: `Merged ${source.firstName} ${source.lastName} into ${target.firstName} ${target.lastName}`,
      targetId,
    });
  } catch (error) {
    console.error('Error merging clients:', error);
    res.status(500).json({ error: 'Failed to merge clients' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  const existing = await prisma.client.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Client not found' });
  }

  await prisma.client.delete({ where: { id } });
  res.status(204).send();
});
