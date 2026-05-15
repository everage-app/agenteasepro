import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

const recentTelemetryErrorFingerprints = new Map<string, number>();
const TELEMETRY_ERROR_DEDUPE_WINDOW_MS = 60 * 1000;

function cleanupTelemetryErrorFingerprints(now = Date.now()) {
  for (const [key, timestamp] of recentTelemetryErrorFingerprints.entries()) {
    if (now - timestamp > TELEMETRY_ERROR_DEDUPE_WINDOW_MS) {
      recentTelemetryErrorFingerprints.delete(key);
    }
  }
}

function normalizeErrorValue(input: unknown, maxLength: number) {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

// VS Code/TS server can occasionally cache Prisma Client types after schema changes.
// Keep this route resilient by using a narrow any-cast for the delegate access.
const prismaDelegate = prisma as any;

const eventSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  path: z.string().trim().max(300).optional(),
  meta: z.record(z.any()).optional(),
});

const errorSchema = z.object({
  source: z.enum(['client', 'server']).default('client'),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(12000).optional(),
  path: z.string().trim().max(300).optional(),
  meta: z.record(z.any()).optional(),
});

router.post('/event', async (req: AuthenticatedRequest, res) => {
  try {
    const payload = eventSchema.parse(req.body);

    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const row = await prismaDelegate.internalEvent.create({
      data: {
        agentId: req.agentId,
        kind: payload.kind,
        path: payload.path,
        meta: payload.meta as any,
      },
      select: { id: true },
    });

    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
});

router.post('/error', async (req: AuthenticatedRequest, res) => {
  try {
    const payload = errorSchema.parse(req.body);

    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const message = normalizeErrorValue(payload.message, 2000);
    if (!message) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const path = normalizeErrorValue(payload.path, 300);
    const stack = normalizeErrorValue(payload.stack, 12000);

    cleanupTelemetryErrorFingerprints();
    const fingerprint = [req.agentId, payload.source, message, path || ''].join('|');
    const now = Date.now();
    const existing = recentTelemetryErrorFingerprints.get(fingerprint);
    if (existing && now - existing <= TELEMETRY_ERROR_DEDUPE_WINDOW_MS) {
      return res.json({ ok: true, deduplicated: true });
    }

    const row = await prismaDelegate.internalError.create({
      data: {
        agentId: req.agentId,
        source: payload.source,
        message,
        stack,
        path,
        meta: payload.meta as any,
      },
      select: { id: true },
    });

    recentTelemetryErrorFingerprints.set(fingerprint, now);

    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
});
