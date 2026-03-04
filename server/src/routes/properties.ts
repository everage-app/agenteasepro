import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const properties = await prisma.property.findMany({ where: { agentId: req.agentId } });
  res.json(properties);
});

// Lightweight address suggestions for listing/property entry
router.get('/suggest', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json([]);
  }

  // Suggest from agent's own properties and listings for now
  const [properties, listings] = await Promise.all([
    prisma.property.findMany({
      where: {
        agentId: req.agentId,
        street: { contains: q, mode: 'insensitive' },
      },
      select: { street: true, city: true, state: true, zip: true },
      take: 5,
    }),
    prisma.listing.findMany({
      where: {
        agentId: req.agentId,
        addressLine1: { contains: q, mode: 'insensitive' },
      },
      select: { addressLine1: true, city: true, state: true, zipCode: true },
      take: 5,
    }),
  ]);

  const all = [...properties, ...listings];
  const seen = new Set<string>();
  const suggestions = all
    .map((p) => {
      const address = 'street' in p ? p.street : (p as any).addressLine1;
      const zipCode = 'zip' in p ? p.zip : (p as any).zipCode;
      const label = [address, p.city, p.state, zipCode].filter(Boolean).join(', ');
      return label;
    })
    .filter((label) => {
      if (!label) return false;
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, 5);

  res.json(suggestions);
});

// Enrich listing details from approximate public data
router.post('/enrich', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { addressLine1, city, state, zipCode } = req.body || {};

  if (!addressLine1 || !city) {
    return res.status(400).json({ error: 'Address and city required' });
  }

  // For now, use the agent's own listings/properties as a soft reference.
  const listing = await prisma.listing.findFirst({
    where: {
      agentId: req.agentId,
      addressLine1: { equals: addressLine1, mode: 'insensitive' },
      city: { equals: city, mode: 'insensitive' },
    },
  });

  const property = listing
    ? null
    : await prisma.property.findFirst({
        where: {
          agentId: req.agentId,
          street: { equals: addressLine1, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        },
      });

  if (!listing && !property) {
    return res.json({
      approx: false,
      message: 'No matching property data found. Please enter details manually.',
    });
  }

  const source: any = listing || property;

  res.json({
    approx: true,
    message:
      'We filled in some details from similar records. Please double-check everything for accuracy.',
    price: source.price ?? null,
    beds: source.beds ?? null,
    baths: source.baths ?? null,
    sqft: source.sqft ?? source.squareFeet ?? null,
    heroImageUrl: source.heroImageUrl ?? (Array.isArray(source.photos) ? source.photos[0] : null),
  });
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const data = req.body;
  const property = await prisma.property.create({
    data: { ...data, agentId: req.agentId },
  });
  res.status(201).json(property);
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.property.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const property = await prisma.property.update({
    where: { id },
    data,
  });
  res.json(property);
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  const existing = await prisma.property.findFirst({
    where: { id, agentId: req.agentId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  await prisma.property.delete({ where: { id } });
  res.status(204).send();
});
