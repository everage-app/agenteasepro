import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getDealStakeholders(req: AuthenticatedRequest, res: Response) {
  const { dealId } = req.params;
  const stakeholders = await prisma.dealStakeholder.findMany({
    where: { dealId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(stakeholders);
}

export async function createDealStakeholder(req: AuthenticatedRequest, res: Response) {
  const { dealId } = req.params;
  const { name, role, email, phone, company, notes } = req.body;

  const stakeholder = await prisma.dealStakeholder.create({
    data: {
      dealId,
      name,
      role,
      email,
      phone,
      company,
      notes,
    },
  });

  res.status(201).json(stakeholder);
}

export async function getDealStakeholder(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const stakeholder = await prisma.dealStakeholder.findUnique({
    where: { id },
  });

  if (!stakeholder) {
    return res.status(404).json({ error: 'DealStakeholder not found' });
  }

  res.json(stakeholder);
}

export async function updateDealStakeholder(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { name, role, email, phone, company, notes } = req.body;

  const updated = await prisma.dealStakeholder.update({
    where: { id },
    data: { name, role, email, phone, company, notes },
  });

  res.json(updated);
}

export async function deleteDealStakeholder(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  await prisma.dealStakeholder.delete({
    where: { id },
  });

  res.status(204).send();
}