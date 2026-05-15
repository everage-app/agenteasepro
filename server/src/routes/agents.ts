import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

// Safe subset of Agent fields — never expose passwordHash, tokens, or internal metadata.
function sanitizeAgent(agent: Record<string, any>) {
  const {
    passwordHash: _ph,
    resetToken: _rt,
    resetTokenExpiry: _rte,
    emailVerifyToken: _evt,
    emailVerifyExpiry: _eve,
    legalAcceptedIp: _lip,
    legalAcceptedUserAgent: _lua,
    ...safe
  } = agent;
  return safe;
}

router.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const agent = await prisma.agent.findUnique({
    where: { id: req.agentId },
    include: {
      deals: { select: { id: true } },
      listings: { select: { id: true } },
    },
  });

  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const stats = {
    dealsCount: agent.deals.length,
    listingsCount: agent.listings.length,
  };

  return res.json({
    agent: sanitizeAgent(agent),
    stats,
  });
});
