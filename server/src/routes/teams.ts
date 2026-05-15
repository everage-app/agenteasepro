/**
 * Team / Brokerage routes — CRUD for teams, invitations, and member management.
 *
 * These are gated by the RBAC middleware created in `middleware/rbac.ts`.
 */
import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

export const router = Router();

// ────────────────────── List my teams ──────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const memberships = await prisma.teamMember.findMany({
    where: { agentId: req.agentId },
    include: {
      team: {
        include: {
          members: {
            include: { agent: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  res.json(memberships.map((m) => ({ ...m.team, myRole: m.role })));
});

// ────────────────────── Create team ──────────────────────
router.post('/', requirePermission('team.manage'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, brokerageName, brokerageLicense } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });

  // Generate a URL-safe slug from team name + random suffix
  const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomBytes(3).toString('hex')}`;

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      slug,
      brokerageName: brokerageName?.trim() || null,
      brokerageLicense: brokerageLicense?.trim() || null,
      members: {
        create: { agentId: req.agentId, role: 'OWNER' },
      },
    },
    include: { members: true },
  });

  res.status(201).json(team);
});

// ────────────────────── Invite member ──────────────────────
router.post('/:teamId/invite', requirePermission('team.invite'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { teamId } = req.params;
  const { email, role = 'AGENT' } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  // Verify caller is on this team with sufficient role
  const callerMembership = await prisma.teamMember.findUnique({
    where: { teamId_agentId: { teamId, agentId: req.agentId } },
  });
  if (!callerMembership || !['OWNER', 'MANAGER'].includes(callerMembership.role)) {
    return res.status(403).json({ error: 'Only owners and managers can invite members' });
  }

  // Prevent duplicate invitations (not yet accepted)
  const existing = await prisma.teamInvitation.findFirst({
    where: { teamId, email: email.trim().toLowerCase(), acceptedAt: null },
  });
  if (existing) return res.status(409).json({ error: 'Invitation already pending' });

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await prisma.teamInvitation.create({
    data: {
      teamId,
      email: email.trim().toLowerCase(),
      role: role as any,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // TODO: send invitation email via SendGrid

  res.status(201).json({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt });
});

// ────────────────────── Accept invitation ──────────────────────
router.post('/invitations/:token/accept', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { token } = req.params;
  const invitation = await prisma.teamInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt) {
    return res.status(404).json({ error: 'Invitation not found or already used' });
  }

  if (invitation.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Invitation has expired' });
  }

  // Check email matches
  const agent = await prisma.agent.findUnique({ where: { id: req.agentId }, select: { email: true } });
  if (agent?.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return res.status(403).json({ error: 'Email does not match invitation' });
  }

  // Add to team + mark invitation accepted
  await prisma.$transaction([
    prisma.teamMember.create({
      data: {
        teamId: invitation.teamId,
        agentId: req.agentId,
        role: invitation.role as any,
      },
    }),
    prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  res.json({ message: 'Team joined successfully', teamId: invitation.teamId });
});

// ────────────────────── Remove member ──────────────────────
router.delete('/:teamId/members/:memberId', requirePermission('team.manage'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { teamId, memberId } = req.params;

  // Verify caller is owner
  const callerMembership = await prisma.teamMember.findUnique({
    where: { teamId_agentId: { teamId, agentId: req.agentId } },
  });
  if (!callerMembership || callerMembership.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only the team owner can remove members' });
  }

  if (memberId === req.agentId) {
    return res.status(400).json({ error: 'Cannot remove yourself — transfer ownership first' });
  }

  await prisma.teamMember.deleteMany({ where: { teamId, agentId: memberId } });
  res.json({ message: 'Member removed' });
});

// ────────────────────── Update member role ──────────────────────
router.patch('/:teamId/members/:memberId', requirePermission('team.manage'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { teamId, memberId } = req.params;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  const callerMembership = await prisma.teamMember.findUnique({
    where: { teamId_agentId: { teamId, agentId: req.agentId } },
  });
  if (!callerMembership || callerMembership.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only the team owner can change roles' });
  }

  const updated = await prisma.teamMember.update({
    where: { teamId_agentId: { teamId, agentId: memberId } },
    data: { role: role as any },
  });

  res.json(updated);
});
