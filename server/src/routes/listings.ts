import { Router } from 'express';
import { ListingStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { dispatchAutomationEvent } from '../automation/runner';
import { prisma } from '../lib/prisma';
export const router = Router();

// GET /api/listings - List all listings with optional filters
router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { status, search } = req.query;

  const where: any = { agentId: req.agentId };

  // Status filter (comma-separated or single)
  if (status && status !== 'ALL') {
    const statuses = String(status).split(',').map(s => s.trim());
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }

  // Search filter (address, city, or MLS)
  if (search) {
    const searchStr = String(search);
    where.OR = [
      { addressLine1: { contains: searchStr, mode: 'insensitive' } },
      { city: { contains: searchStr, mode: 'insensitive' } },
      { mlsId: { contains: searchStr, mode: 'insensitive' } },
    ];
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: [
      { isFeatured: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  res.json(listings);
});

// POST /api/listings - Create new listing
router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    addressLine1,
    city,
    state = 'UT',
    zipCode,
    mlsId,
    headline,
    description,
    price,
    beds,
    baths,
    sqft,
    status = 'ACTIVE',
    heroImageUrl,
    isFeatured = false,
  } = req.body;

  // Validate required fields
  if (!addressLine1 || !city || !zipCode || !headline || !description || price == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const listing = await prisma.listing.create({
    data: {
      agentId: req.agentId,
      addressLine1,
      city,
      state,
      zipCode,
      mlsId,
      headline,
      description,
      price: parseInt(price),
      beds: beds ? parseInt(beds) : null,
      baths: baths ? parseFloat(baths) : null,
      sqft: sqft ? parseInt(sqft) : null,
      status: status as ListingStatus,
      heroImageUrl,
      isFeatured,
    },
  });

  // Trigger automation workflows
  dispatchAutomationEvent({
    type: 'LISTING_CREATED',
    listingId: listing.id,
    agentId: req.agentId,
  }).catch(err => console.error('Automation dispatch failed:', err));

  res.status(201).json(listing);
});

// PATCH /api/listings/:id - Update listing
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  // Verify ownership
  const existing = await prisma.listing.findFirst({
    where: { id, agentId: req.agentId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const updateData: any = {};

  // Only update provided fields
  if (req.body.addressLine1 !== undefined) updateData.addressLine1 = req.body.addressLine1;
  if (req.body.city !== undefined) updateData.city = req.body.city;
  if (req.body.state !== undefined) updateData.state = req.body.state;
  if (req.body.zipCode !== undefined) updateData.zipCode = req.body.zipCode;
  if (req.body.mlsId !== undefined) updateData.mlsId = req.body.mlsId;
  if (req.body.headline !== undefined) updateData.headline = req.body.headline;
  if (req.body.description !== undefined) updateData.description = req.body.description;
  if (req.body.price !== undefined) updateData.price = parseInt(req.body.price);
  if (req.body.beds !== undefined) updateData.beds = req.body.beds ? parseInt(req.body.beds) : null;
  if (req.body.baths !== undefined) updateData.baths = req.body.baths ? parseFloat(req.body.baths) : null;
  if (req.body.sqft !== undefined) updateData.sqft = req.body.sqft ? parseInt(req.body.sqft) : null;
  if (req.body.status !== undefined) updateData.status = req.body.status;
  if (req.body.heroImageUrl !== undefined) updateData.heroImageUrl = req.body.heroImageUrl;
  if (req.body.isFeatured !== undefined) updateData.isFeatured = req.body.isFeatured;

  const listing = await prisma.listing.update({
    where: { id },
    data: updateData,
  });

  res.json(listing);
});

// DELETE /api/listings/:id - Delete listing
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  // Verify ownership
  const existing = await prisma.listing.findFirst({
    where: { id, agentId: req.agentId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  await prisma.listing.delete({ where: { id } });

  res.json({ success: true });
});

// POST /api/listings/:id/mark-blasted - Increment blast counter
router.post('/:id/mark-blasted', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  // Verify ownership
  const existing = await prisma.listing.findFirst({
    where: { id, agentId: req.agentId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      totalBlasts: { increment: 1 },
    },
  });

  res.json(listing);
});
