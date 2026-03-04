import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

export const router = Router();

const createSupportSchema = z.object({
  category: z.enum(['GENERAL', 'SUGGESTION', 'BILLING', 'BUG']).default('GENERAL'),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  pagePath: z.string().trim().max(300).optional(),
  pageUrl: z.string().trim().max(600).optional(),
  meta: z.record(z.any()).optional(),
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = createSupportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { category, subject, message, priority, pagePath, pageUrl, meta } = parsed.data;

  const support = await prisma.supportRequest.create({
    data: {
      agentId: req.agentId,
      category,
      subject,
      message,
      priority,
      pagePath,
      pageUrl,
      userAgent: req.get('user-agent') || undefined,
      meta,
    },
  });

  return res.json({ support });
});
