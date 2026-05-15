import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getRoutingRules(req: AuthenticatedRequest, res: Response) {
  const { groupId } = req.query;
  const rules = await prisma.routingRule.findMany({
    where: groupId ? { groupId: String(groupId) } : undefined,
    orderBy: { priority: 'asc' },
  });
  res.json(rules);
}

export async function createRoutingRule(req: AuthenticatedRequest, res: Response) {
  const { groupId, name, priority, criteria, assignTo } = req.body;

  const rule = await prisma.routingRule.create({
    data: {
      groupId,
      name,
      priority: priority || 0,
      criteria: criteria || {},
      assignTo,
    },
  });

  res.status(201).json(rule);
}

export async function getRoutingRule(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const rule = await prisma.routingRule.findUnique({
    where: { id },
  });

  if (!rule) {
    return res.status(404).json({ error: 'RoutingRule not found' });
  }

  res.json(rule);
}

export async function updateRoutingRule(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { name, priority, criteria, assignTo } = req.body;

  const updated = await prisma.routingRule.update({
    where: { id },
    data: { name, priority, criteria, assignTo },
  });

  res.json(updated);
}

export async function deleteRoutingRule(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  await prisma.routingRule.delete({
    where: { id },
  });

  res.status(204).send();
}