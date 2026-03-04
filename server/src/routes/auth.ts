import { Router } from 'express';
import { ClientRole, ClientStage } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { getLegalPolicies, recordAgentLegalAcceptance } from '../lib/legalPolicies';
import { sendPasswordResetEmail } from '../services/emailService';
import {
  signup as idSignup,
  login as idLogin,
  refreshAccessToken,
  revokeRefreshToken,
  requestPasswordReset,
  executePasswordReset,
  changePassword,
  signLegacyToken,
  validatePassword,
  verifyEmail,
  resendVerificationCode,
} from '../services/identityService';
import { auditLog, extractIp } from '../services/securityAuditService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

export const router = Router();

// ── Rate limiting for auth endpoints ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// Apply to all auth routes
router.use(authLimiter);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const SignupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

/** RequestContext helper */
function reqCtx(req: any) {
  return { ip: extractIp(req), userAgent: req.get?.('user-agent') || undefined };
}

async function ensureDemoSampleClients(agentId: string) {
  const samples = [
    {
      firstName: 'John',
      lastName: 'Buyer',
      email: 'john.buyer@example.com',
      phone: '3855550101',
      role: ClientRole.BUYER,
      stage: ClientStage.NEW_LEAD,
      leadSource: 'Demo',
      referralRank: 'C' as const,
      notes: 'Demo sample client',
      tags: ['demo'],
    },
    {
      firstName: 'Sarah',
      lastName: 'Seller',
      email: 'sarah.seller@example.com',
      phone: '3855550102',
      role: ClientRole.SELLER,
      stage: ClientStage.NEW_LEAD,
      leadSource: 'Demo',
      referralRank: 'C' as const,
      notes: 'Demo sample client',
      tags: ['demo'],
    },
    {
      firstName: 'Casey',
      lastName: 'Referral',
      email: 'casey.referral@example.com',
      phone: '3855550103',
      role: ClientRole.OTHER,
      stage: ClientStage.NURTURE,
      leadSource: 'Open House',
      referralRank: 'B' as const,
      notes: 'Demo sample client',
      tags: ['demo'],
    },
  ];

  const keepIds: string[] = [];

  for (const sample of samples) {
    const existing = await prisma.client.findFirst({
      where: {
        agentId,
        email: sample.email,
      },
      select: { id: true },
    });

    if (existing) {
      keepIds.push(existing.id);
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          firstName: sample.firstName,
          lastName: sample.lastName,
          phone: sample.phone,
          role: sample.role,
          stage: sample.stage,
          leadSource: sample.leadSource,
          referralRank: sample.referralRank,
          notes: sample.notes,
          tags: sample.tags,
        },
      });
      continue;
    }

    const created = await prisma.client.create({
      data: {
        agentId,
        firstName: sample.firstName,
        lastName: sample.lastName,
        email: sample.email,
        phone: sample.phone,
        role: sample.role,
        stage: sample.stage,
        leadSource: sample.leadSource,
        referralRank: sample.referralRank,
        notes: sample.notes,
        tags: sample.tags,
      },
      select: { id: true },
    });
    keepIds.push(created.id);
  }

  // Best-effort cleanup: remove extra demo clients that aren't referenced by anything.
  // (Avoids FK violations for demo data that may have deals/tasks attached.)
  try {
    const others = await prisma.client.findMany({
      where: {
        agentId,
        id: { notIn: keepIds },
      },
      select: {
        id: true,
        _count: {
          select: {
            buyerDeals: true,
            sellerDeals: true,
            tasks: true,
            leads: true,
            savedListings: true,
            searchCriteria: true,
          },
        },
      },
    });

    const deletableIds = others
      .filter(c => {
        const counts = c._count;
        return (
          counts.buyerDeals === 0 &&
          counts.sellerDeals === 0 &&
          counts.tasks === 0 &&
          counts.leads === 0 &&
          counts.savedListings === 0 &&
          counts.searchCriteria === 0
        );
      })
      .map(c => c.id);

    if (deletableIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: deletableIds } },
      });
    }
  } catch (err) {
    console.warn('Demo client cleanup skipped:', err);
  }
}

router.post('/signup', async (req, res) => {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid signup data' });
    }

    const { email, password, name } = parsed.data;

    const result = await idSignup(email, password, name, reqCtx(req));
    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }

    try {
      const policies = await getLegalPolicies();
      if (result.agent?.id) {
        await recordAgentLegalAcceptance(result.agent.id, policies, reqCtx(req));
      }
    } catch (legalErr) {
      console.error('Failed to record legal acceptance during signup:', legalErr);
    }

    return res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      agent: result.agent,
      emailVerified: result.emailVerified ?? false,
    });
  } catch (err) {
    console.error('Signup error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/legal-policies', async (_req, res) => {
  try {
    const policies = await getLegalPolicies();
    return res.json(policies);
  } catch (err) {
    console.error('Failed to load legal policies:', err);
    return res.status(500).json({ error: 'Failed to load legal policies' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login data' });
    }

    const { email, password } = parsed.data;

    const result = await idLogin(email, password, reqCtx(req));
    if (!result.success) {
      const status = result.locked ? 423 : 401;
      return res.status(status).json({
        error: result.error,
        locked: result.locked || false,
        remainingAttempts: result.remainingAttempts,
      });
    }

    return res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      agent: result.agent,
      emailVerified: result.emailVerified ?? true,
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public demo access (production-safe): restricted to the demo account only.
router.post('/demo-login', async (req, res) => {
  const allowDemo = (process.env.ALLOW_DEMO_LOGIN || '').toLowerCase();
  if (allowDemo === 'false') {
    return res.status(404).json({ error: 'Not found' });
  }

  const demoEmail = normalizeEmail(process.env.DEMO_LOGIN_EMAIL || 'demo@agentease.com');

  const agent = await prisma.agent.upsert({
    where: { email: demoEmail },
    update: {},
    create: { email: demoEmail, name: 'Demo Agent' },
  });

  try {
    await ensureDemoSampleClients(agent.id);
  } catch (err) {
    console.warn('Demo sample client ensure failed:', err);
  }

  try {
    const token = signLegacyToken(agent.id);

    await auditLog({
      action: 'AUTH_DEMO_LOGIN',
      agentId: agent.id,
      email: demoEmail,
      ip: extractIp(req),
      userAgent: req.get('user-agent'),
      detail: 'Demo login',
    });

    return res.json({ token, agent });
  } catch (err) {
    console.error('JWT signing error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
});

router.post('/dev-login', async (req, res) => {
  const env = (process.env.NODE_ENV || '').toLowerCase();

  // SECURITY: Never allow dev-login in production, regardless of env vars
  if (env === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const allowDevLogin = (process.env.ALLOW_DEV_LOGIN || '').toLowerCase() === 'true';
  if (!allowDevLogin && env !== 'development' && env !== 'test') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = normalizeEmail(email);

  const agent = await prisma.agent.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail, name: normalizedEmail.split('@')[0] || 'Agent' },
  });

  try {
    const token = signLegacyToken(agent.id);

    await auditLog({
      action: 'AUTH_DEV_LOGIN',
      agentId: agent.id,
      email: normalizedEmail,
      ip: extractIp(req),
      userAgent: req.get('user-agent'),
      detail: 'Dev login',
    });

    return res.json({ token, agent });
  } catch (err) {
    console.error('JWT signing error', err);
    return res.status(500).json({ error: 'Server misconfigured' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const result = await requestPasswordReset(email, reqCtx(req));

  // Send email if we got a token (account exists)
  if (result.resetToken && result.resetUrl) {
    const agent = await prisma.agent.findUnique({ where: { email: normalizeEmail(email) } });
    if (agent) {
      const emailResult = await sendPasswordResetEmail({
        email: agent.email,
        resetUrl: result.resetUrl,
        expiresAt: new Date(Date.now() + 3600000),
      });

      if (!emailResult.success) {
        console.warn('Password reset email failed:', emailResult.error);
      }
    }
  }

  // Always return generic success (don't reveal account existence)
  return res.json({ success: true, message: 'If that email exists, we sent reset instructions' });
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  const result = await executePasswordReset(token, password, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Password reset successful' });
});

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .strict();

router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid password payload' });
  }

  const result = await changePassword(
    req.agentId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    reqCtx(req),
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Unable to change password' });
  }

  return res.json({ success: true, message: 'Password changed successfully' });
});
// ── Token refresh (rotate access + refresh pair) ──────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const result = await refreshAccessToken(refreshToken, reqCtx(req));

  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }

  return res.json({
    token: result.token,
    refreshToken: result.refreshToken,
    agent: result.agent,
  });
});

// ── Logout (revoke refresh token) ─────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken, reqCtx(req));
  }
  return res.json({ success: true, message: 'Logged out' });
});

// ── Email Verification ────────────────────────────────────────────

// Verify email with 6-digit code (requires auth token)
router.post('/verify-email', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await verifyEmail(req.agentId, code, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, emailVerified: true });
});

// Resend verification code (requires auth token)
router.post('/resend-verification', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await resendVerificationCode(req.agentId, reqCtx(req));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Verification code sent' });
});