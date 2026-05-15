import { AgentStatus } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/identityService';
import { auditLog, extractIp } from '../services/securityAuditService';
import { prisma } from '../lib/prisma';

export interface AuthenticatedRequest extends Request {
  agentId?: string;
  requestId?: string;
  user?: { id: string; email?: string; name?: string; role?: string; permissions?: string[] };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only accept access tokens for API routes (not refresh tokens)
  if (payload.type === 'refresh') {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!payload.agentId || typeof payload.agentId !== 'string' || !payload.agentId.trim()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const agentId = payload.agentId.trim();
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, email: true, status: true },
  });

  if (!agent) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (agent.status !== AgentStatus.ACTIVE) {
    await auditLog({
      action: 'AUTH_LOGIN_FAILED',
      agentId: agent.id,
      email: agent.email,
      ip: extractIp(req),
      userAgent: req.get('user-agent') || undefined,
      detail: `Rejected API access for ${agent.status.toLowerCase()} account`,
      meta: {
        accountStatus: agent.status,
      },
    });
    return res.status(403).json({ error: 'Account unavailable' });
  }

  req.agentId = agent.id;
  req.user = {
    id: agent.id,
    email: agent.email || payload.email,
  };
  next();
};

// Export alias for convenience
export const authenticateToken = authMiddleware;
