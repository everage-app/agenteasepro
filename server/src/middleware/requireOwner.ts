import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function getOwnerConfig() {
  const ownerEmail = process.env.AGENTEASE_OWNER_EMAIL;
  const ownerId = process.env.AGENTEASE_OWNER_ID;
  return {
    ownerEmail: ownerEmail ? normalizeEmail(ownerEmail) : null,
    ownerId: ownerId?.trim() || null,
  };
}

export async function isOwnerRequest(req: AuthenticatedRequest): Promise<boolean> {
  const { ownerEmail, ownerId } = getOwnerConfig();
  if (!req.agentId) return false;

  if (ownerId && req.agentId === ownerId) return true;

  if (ownerEmail) {
    const agent = await prisma.agent.findUnique({
      where: { id: req.agentId },
      select: { email: true },
    });

    if (!agent?.email) return false;
    return normalizeEmail(agent.email) === ownerEmail;
  }

  // If owner env isn't configured, deny by default (safe).
  return false;
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
