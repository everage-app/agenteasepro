import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

router.get('/:dealId', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId } = req.params;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, agentId: req.agentId },
    select: { id: true },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const addendums = await prisma.addendum.findMany({ where: { dealId } });
  res.json(addendums);
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as any;
  const dealId = body?.dealId as string | undefined;
  const { dealId: _ignored, ...rest } = body || {};
  if (!dealId) {
    return res.status(400).json({ error: 'dealId is required' });
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, agentId: req.agentId },
    select: { id: true },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const addendum = await prisma.addendum.create({
    data: {
      ...rest,
      deal: { connect: { id: dealId } },
    },
  });
  res.status(201).json(addendum);
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.addendum.findFirst({
    where: {
      id,
      deal: { agentId: req.agentId },
    },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Addendum not found' });
  }

  const addendum = await prisma.addendum.update({ where: { id }, data });
  res.json(addendum);
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  const existing = await prisma.addendum.findFirst({
    where: {
      id,
      deal: { agentId: req.agentId },
    },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Addendum not found' });
  }

  await prisma.addendum.delete({ where: { id } });
  res.status(204).send();
});
