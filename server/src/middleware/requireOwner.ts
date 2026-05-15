import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { getOwnerConfig, normalizeOwnerEmail } from '../lib/ownerConfig';
import { getInternalAccessForRequest } from '../services/internalOpsService';

export async function isOwnerRequest(req: AuthenticatedRequest): Promise<boolean> {
  const { ownerEmails, ownerIds } = getOwnerConfig();
  if (!req.agentId) return false;

  if (ownerIds.has(req.agentId)) return true;

  if (ownerEmails.size > 0) {
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId },
      select: { email: true },
    });

    if (!agent?.email) return false;
    return ownerEmails.has(normalizeOwnerEmail(agent.email));
  }

  // If owner env isn't configured, deny by default (safe).
  return false;
}

export async function isInternalRequest(req: AuthenticatedRequest): Promise<boolean> {
  const access = await getInternalAccessForRequest(req);
  return access.allowed;
}

export async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const allowed = await isOwnerRequest(req);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  } catch (err) {
    console.error('Owner gate error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
}

export async function requireInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const allowed = await isInternalRequest(req);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  } catch (err) {
    console.error('Internal gate error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
}
