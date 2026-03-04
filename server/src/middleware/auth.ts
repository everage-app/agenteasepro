import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/identityService';
import { auditLog, extractIp } from '../services/securityAuditService';

export interface AuthenticatedRequest extends Request {
  agentId?: string;
  requestId?: string;
  user?: { id: string; email?: string; name?: string; role?: string; permissions?: string[] };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

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

  req.agentId = payload.agentId.trim();
  req.user = {
    id: payload.agentId.trim(),
    email: payload.email,
  };
  next();
};

// Export alias for convenience
export const authenticateToken = authMiddleware;
