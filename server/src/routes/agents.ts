import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

router.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const agent = await prisma.agent.findUnique({
    where: { id: req.agentId },
    include: {
      deals: true,
      listings: true,
    },
  });

  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const stats = {
    dealsCount: agent.deals.length,
    listingsCount: agent.listings.length,
  };

  return res.json({
    agent: {
      ...agent,
      emailVerified: agent.emailVerified,
    },
    stats,
  });
});
