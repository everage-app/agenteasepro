import { Router } from 'express';
import { DealStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { dispatchAutomationEvent } from '../automation/runner';
import { prisma } from '../lib/prisma';
import { hasDealPermission } from '../lib/dealPermissions';
import { fillRepcPdf, generateSignedContractPdf } from '../services/pdfService';
import path from 'path';
import fs from 'fs';
export const router = Router();

const dealInclude = {
  property: true,
  buyer: true,
  seller: true,
  repc: true,
  forms: {
    include: {
      definition: {
        select: {
          code: true,
          displayName: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  },
  signatureEnvelopes: {
    include: { signers: true },
    orderBy: { createdAt: 'desc' },
  },
} as const;

const terminalStatuses = new Set<DealStatus>([DealStatus.CLOSED, DealStatus.FELL_THROUGH]);

function parseBooleanFlag(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function ensurePermission(req: AuthenticatedRequest, res: any, permission: Parameters<typeof hasDealPermission>[1]) {
  if (!hasDealPermission(req, permission)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

async function logDealEvent(agentId: string, dealId: string, title: string, description?: string) {
  try {
    await prisma.dealEvent.create({
      data: {
        agentId,
        dealId,
        type: 'OTHER',
        title,
        description,
        date: new Date(),
        createdFrom: 'MANUAL',
      },
    });
  } catch (error) {
    console.warn('Failed to log deal event:', error);
  }
}

async function autoArchiveEligibleDeals(agentId: string) {
  const deals = await prisma.deal.findMany({
    where: {
      agentId,
      archivedAt: null,
      status: {
        in: [DealStatus.CLOSED, DealStatus.FELL_THROUGH],
      },
    },
    select: {
      id: true,
      status: true,
      closedAt: true,
      updatedAt: true,
      archiveAfterDays: true,
    },
  });

  const now = new Date();
  for (const deal of deals) {
    if (!deal.archiveAfterDays || deal.archiveAfterDays <= 0) continue;

    const anchorDate = deal.closedAt || deal.updatedAt;
    const ageMs = now.getTime() - anchorDate.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays < deal.archiveAfterDays) continue;

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        archivedAt: now,
        archivedReason: `Auto-archived after ${deal.archiveAfterDays} days`,
        lastActivityAt: now,
      },
    });

    await logDealEvent(
      agentId,
      deal.id,
      'Deal auto-archived',
      `Automatically archived based on retention policy (${deal.archiveAfterDays} days).`,
    );
  }
}

router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  if (!ensurePermission(req, res, 'deals.read')) return;

  const includeArchived = parseBooleanFlag(req.query.includeArchived);
  await autoArchiveEligibleDeals(req.agentId);

  const deals = await prisma.deal.findMany({
    where: {
      agentId: req.agentId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    include: dealInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(deals);
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.read')) return;

  const { id } = req.params;
  const deal = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    include: dealInclude,
  });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json(deal);
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.update')) return;

  const { title, property, buyer, seller, offerReferenceDate, status } = req.body;

  const normalizedProperty = {
    ...property,
    taxId: property?.taxId || property?.parcelId || undefined,
  };

  const normalizedStatus = Object.values(DealStatus).includes(status)
    ? status
    : DealStatus.ACTIVE;

  const propertyRecord = await prisma.property.create({
    data: {
      ...normalizedProperty,
      agentId: req.agentId,
    },
  });

  const resolvePartyClient = async (party: any) => {
    if (!party) return null;

    if (party.clientId) {
      const existingClient = await prisma.client.findFirst({
        where: {
          id: String(party.clientId),
          agentId: req.agentId,
        },
      });
      if (!existingClient) {
        throw new Error('Selected client not found for this account.');
      }
      return existingClient;
    }

    const payload = {
      role: party.role,
      firstName: party.firstName,
      lastName: party.lastName,
      email: party.email,
      phone: party.phone,
      agentId: req.agentId,
    };

    return prisma.client.create({ data: payload });
  };

  let buyerRecord = null;
  let sellerRecord = null;
  try {
    buyerRecord = await resolvePartyClient(buyer);
    sellerRecord = await resolvePartyClient(seller);
  } catch (partyError: any) {
    return res.status(400).json({ error: partyError?.message || 'Invalid client selection.' });
  }

  const deal = await prisma.deal.create({
    data: {
      title,
      propertyId: propertyRecord.id,
      agentId: req.agentId,
      buyerId: buyerRecord?.id,
      sellerId: sellerRecord?.id,
      offerReferenceDate: new Date(offerReferenceDate),
      status: normalizedStatus,
      closedAt: terminalStatuses.has(normalizedStatus) ? new Date() : null,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(req.agentId, deal.id, 'Deal created', `Created deal "${deal.title}".`);

  // Trigger automation workflows
  dispatchAutomationEvent({
    type: 'DEAL_CREATED',
    dealId: deal.id,
    agentId: req.agentId,
  }).catch(err => console.error('Automation dispatch failed:', err));

  res.status(201).json(deal);
});

router.patch('/:id/status', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.update')) return;

  const { id } = req.params;
  const { status } = req.body as { status: DealStatus };

  const existing = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const safeStatus = Object.values(DealStatus).includes(status) ? status : DealStatus.ACTIVE;
  const previous = await prisma.deal.findUnique({ where: { id }, select: { status: true } });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      status: safeStatus,
      closedAt: terminalStatuses.has(safeStatus) ? new Date() : null,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(
    req.agentId,
    id,
    'Deal status changed',
    `Status changed from ${previous?.status || 'UNKNOWN'} to ${safeStatus}.`,
  );

  res.json(deal);
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.update')) return;

  const { id } = req.params;
  const {
    title,
    status,
    offerReferenceDate,
    archiveAfterDays,
    property,
    buyer,
    seller,
  } = req.body as {
    title?: string;
    status?: DealStatus;
    offerReferenceDate?: string;
    archiveAfterDays?: number;
    property?: Record<string, any>;
    buyer?: Record<string, any>;
    seller?: Record<string, any>;
  };

  const existing = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    include: {
      property: true,
      buyer: true,
      seller: true,
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const updates: string[] = [];

  await prisma.$transaction(async (tx) => {
    if (property && existing.propertyId) {
      const propertyData = {
        ...(property.street !== undefined && { street: property.street }),
        ...(property.city !== undefined && { city: property.city }),
        ...(property.state !== undefined && { state: property.state }),
        ...(property.zip !== undefined && { zip: property.zip }),
        ...(property.county !== undefined && { county: property.county }),
        ...(property.taxId !== undefined && { taxId: property.taxId }),
        ...(property.notes !== undefined && { notes: property.notes }),
        ...(property.mlsId !== undefined && { mlsId: property.mlsId }),
      };
      if (Object.keys(propertyData).length > 0) {
        await tx.property.update({ where: { id: existing.propertyId }, data: propertyData });
        updates.push('property');
      }
    }

    let buyerId = existing.buyerId;
    if (buyer) {
      const buyerData = {
        ...(buyer.firstName !== undefined && { firstName: buyer.firstName }),
        ...(buyer.lastName !== undefined && { lastName: buyer.lastName }),
        ...(buyer.email !== undefined && { email: buyer.email }),
        ...(buyer.phone !== undefined && { phone: buyer.phone }),
      };
      if (existing.buyerId) {
        if (Object.keys(buyerData).length > 0) {
          await tx.client.update({ where: { id: existing.buyerId }, data: buyerData });
          updates.push('buyer');
        }
      } else if (buyer.firstName || buyer.lastName || buyer.email) {
        const createdBuyer = await tx.client.create({
          data: {
            agentId: req.agentId!,
            firstName: buyer.firstName || 'Buyer',
            lastName: buyer.lastName || '',
            email: buyer.email || undefined,
            phone: buyer.phone || undefined,
          },
        });
        buyerId = createdBuyer.id;
        updates.push('buyer');
      }
    }

    let sellerId = existing.sellerId;
    if (seller) {
      const sellerData = {
        ...(seller.firstName !== undefined && { firstName: seller.firstName }),
        ...(seller.lastName !== undefined && { lastName: seller.lastName }),
        ...(seller.email !== undefined && { email: seller.email }),
        ...(seller.phone !== undefined && { phone: seller.phone }),
      };
      if (existing.sellerId) {
        if (Object.keys(sellerData).length > 0) {
          await tx.client.update({ where: { id: existing.sellerId }, data: sellerData });
          updates.push('seller');
        }
      } else if (seller.firstName || seller.lastName || seller.email) {
        const createdSeller = await tx.client.create({
          data: {
            agentId: req.agentId!,
            firstName: seller.firstName || 'Seller',
            lastName: seller.lastName || '',
            email: seller.email || undefined,
            phone: seller.phone || undefined,
          },
        });
        sellerId = createdSeller.id;
        updates.push('seller');
      }
    }

    const nextStatus = status && Object.values(DealStatus).includes(status) ? status : undefined;
    await tx.deal.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(offerReferenceDate !== undefined && { offerReferenceDate: new Date(offerReferenceDate) }),
        ...(nextStatus !== undefined && { status: nextStatus }),
        ...(nextStatus !== undefined && { closedAt: terminalStatuses.has(nextStatus) ? new Date() : null }),
        ...(archiveAfterDays !== undefined && {
          archiveAfterDays: Math.max(0, Math.min(3650, Number(archiveAfterDays) || 0)),
        }),
        ...(buyerId !== existing.buyerId && { buyerId }),
        ...(sellerId !== existing.sellerId && { sellerId }),
        lastActivityAt: new Date(),
      },
    });
  });

  const updatedDeal = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    include: dealInclude,
  });

  await logDealEvent(
    req.agentId,
    id,
    'Deal updated',
    updates.length > 0
      ? `Updated ${Array.from(new Set(updates)).join(', ')} and deal metadata.`
      : 'Updated deal metadata.',
  );

  return res.json(updatedDeal);
});

router.patch('/:id/archive', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.archive')) return;

  const { id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  const existing = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true, archivedAt: true },
  });

  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  if (existing.archivedAt) return res.status(400).json({ error: 'Deal is already archived' });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedReason: reason || 'Archived manually',
      archivedByAgentId: req.agentId,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(req.agentId, id, 'Deal archived', reason || 'Archived manually.');
  return res.json(deal);
});

router.patch('/:id/unarchive', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.archive')) return;

  const { id } = req.params;
  const existing = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true, archivedAt: true },
  });

  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  if (!existing.archivedAt) return res.status(400).json({ error: 'Deal is not archived' });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      archivedAt: null,
      archivedReason: null,
      archivedByAgentId: null,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(req.agentId, id, 'Deal restored', 'Moved from archive back to active records.');
  return res.json(deal);
});

router.patch('/:id/archive-policy', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.manageArchivePolicy')) return;

  const { id } = req.params;
  const parsedDays = Number(req.body?.archiveAfterDays);
  if (!Number.isFinite(parsedDays)) {
    return res.status(400).json({ error: 'archiveAfterDays is required' });
  }

  const archiveAfterDays = Math.max(0, Math.min(3650, Math.round(parsedDays)));
  const existing = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      archiveAfterDays,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(
    req.agentId,
    id,
    'Archive policy updated',
    archiveAfterDays > 0
      ? `Auto-archive set to ${archiveAfterDays} days after close.`
      : 'Auto-archive disabled for this deal.',
  );

  return res.json(deal);
});

router.get('/:id/activity', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.activity.read')) return;

  const { id } = req.params;
  const deal = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      archivedAt: true,
    },
  });

  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const [events, tasks, forms, addendums, envelopes] = await Promise.all([
    prisma.dealEvent.findMany({
      where: { dealId: id, agentId: req.agentId },
      orderBy: { date: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        createdFrom: true,
      },
    }),
    prisma.task.findMany({
      where: { dealId: id, agentId: req.agentId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.formInstance.findMany({
      where: { dealId: id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.addendum.findMany({
      where: { dealId: id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.signatureEnvelope.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        createdAt: true,
        signers: {
          select: {
            id: true,
            signedAt: true,
          },
        },
      },
    }),
  ]);

  const timeline = [
    {
      id: `deal-created-${deal.id}`,
      type: 'DEAL',
      title: 'Deal created',
      description: `Deal "${deal.title}" was created.`,
      at: deal.createdAt,
      meta: { status: deal.status },
    },
    ...events.map((event) => ({
      id: `event-${event.id}`,
      type: 'EVENT',
      title: event.title,
      description: event.description,
      at: event.date,
      meta: { createdFrom: event.createdFrom },
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'TASK',
      title: task.title,
      description: `Task ${task.status} (${task.priority})`,
      at: task.updatedAt || task.createdAt,
      meta: { status: task.status, priority: task.priority },
    })),
    ...forms.map((form) => ({
      id: `form-${form.id}`,
      type: 'FORM',
      title: form.title,
      description: `Form ${form.status}`,
      at: form.updatedAt || form.createdAt,
      meta: { status: form.status },
    })),
    ...addendums.map((addendum) => ({
      id: `addendum-${addendum.id}`,
      type: 'ADDENDUM',
      title: addendum.title,
      description: 'Addendum updated',
      at: addendum.updatedAt || addendum.createdAt,
      meta: {},
    })),
    ...envelopes.map((envelope) => ({
      id: `envelope-${envelope.id}`,
      type: 'ESIGN',
      title: `${envelope.type} envelope`,
      description: `${envelope.signers.filter((signer) => Boolean(signer.signedAt)).length}/${envelope.signers.length} signatures complete`,
      at: envelope.createdAt,
      meta: { type: envelope.type, signerCount: envelope.signers.length },
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 400);

  return res.json({
    deal: {
      id: deal.id,
      title: deal.title,
      status: deal.status,
      archivedAt: deal.archivedAt,
      updatedAt: deal.updatedAt,
    },
    items: timeline,
  });
});

router.patch('/:id/attach-client', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ensurePermission(req, res, 'deals.update')) return;

  const { id } = req.params;
  const { clientId, role } = req.body as { clientId?: string; role?: 'BUYER' | 'SELLER' };

  if (!clientId || (role !== 'BUYER' && role !== 'SELLER')) {
    return res.status(400).json({ error: 'clientId and role are required' });
  }

  const deal = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, agentId: req.agentId },
    select: { id: true },
  });

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const data = role === 'BUYER' ? { buyerId: clientId } : { sellerId: clientId };
  const updated = await prisma.deal.update({
    where: { id },
    data: {
      ...data,
      lastActivityAt: new Date(),
    },
  });

  await logDealEvent(req.agentId, id, 'Client attached to deal', `${role} linked to this deal.`);

  res.json(updated);
});

// Get REPC PDF for a deal (blank template or filled if data exists)
router.get('/:id/repc/pdf', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const download = req.query.download === '1' || req.query.download === 'true';
  const blank = req.query.blank === '1' || req.query.blank === 'true';

  // Verify deal belongs to this agent
  const deal = await prisma.deal.findFirst({
    where: { id, agentId: req.agentId },
    include: { repc: true, property: true, buyer: true, seller: true },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  // Get the REPC form definition for the PDF template path
  const def = await prisma.formDefinition.findUnique({ where: { code: 'REPC' } });
  if (!def) {
    return res.status(404).json({ error: 'REPC form definition not found' });
  }

  // Resolve the PDF template path
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const absolutePath = path.resolve(repoRoot, def.officialPdfPath);

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      error: 'REPC PDF template not found on server',
      expectedPath: def.officialPdfPath,
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="Utah-REPC-${deal.property?.street || id}.pdf"`,
  );

  // If blank requested or no REPC data, return the template
  if (blank || !deal.repc) {
    return res.sendFile(absolutePath);
  }

  // Fill the PDF with REPC data
  try {
    const repcData = deal.repc as any;
    const filledPdf = await fillRepcPdf(absolutePath, {
      // Property info
      street: deal.property?.street || repcData.street,
      city: deal.property?.city || repcData.city,
      state: deal.property?.state || repcData.state,
      zip: deal.property?.zip || repcData.zip,
      county: deal.property?.county || repcData.county,
      mlsId: deal.property?.mlsId || repcData.mlsId,
      taxId: deal.property?.taxId || repcData.propertyTaxId,
      
      // Parties
      buyerNames: deal.buyer 
        ? `${deal.buyer.firstName} ${deal.buyer.lastName}`.trim()
        : repcData.buyerNames,
      buyerEmail: deal.buyer?.email || repcData.buyerEmail,
      sellerNames: deal.seller
        ? `${deal.seller.firstName} ${deal.seller.lastName}`.trim()
        : repcData.sellerNames,
      sellerEmail: deal.seller?.email || repcData.sellerEmail,
      
      // Price & financing
      purchasePrice: repcData.purchasePrice,
      earnestMoney: repcData.earnestMoney,
      earnestMoneyDeliveryDays: repcData.earnestMoneyDeliveryDays,
      downPayment: repcData.downPayment,
      loanAmount: repcData.loanAmount,
      
      // Dates
      acceptanceDeadline: repcData.acceptanceDeadline,
      dueDiligenceDeadline: repcData.dueDiligenceDeadline,
      financingAppraisalDeadline: repcData.financingAppraisalDeadline,
      settlementDeadline: repcData.settlementDeadline,
      possessionDate: repcData.possessionDate,
      
      // Financing details
      financingType: repcData.financingType,
      loanType: repcData.loanType,
    });
    
    return res.send(filledPdf);
  } catch (error) {
    console.error('Error filling REPC PDF:', error);
    // Fallback to blank template on error
    return res.sendFile(absolutePath);
  }
});
