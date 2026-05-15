/**
 * Distributed lock using PostgreSQL (Prisma DistributedLock model).
 * Prevents duplicate processing across multiple Heroku dynos.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const INSTANCE_ID = `${process.env.DYNO || 'local'}-${crypto.randomBytes(4).toString('hex')}`;

/**
 * Attempt to acquire a named lock. Returns true if acquired.
 * Uses PostgreSQL upsert with conditional expiry check for atomic locking.
 */
export async function acquireLock(lockId: string, ttlMs: number = 60_000): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Try to create the lock or take it over if expired
    const result = await prisma.$executeRaw`
      INSERT INTO "DistributedLock" ("id", "lockedBy", "lockedAt", "expiresAt")
      VALUES (${lockId}, ${INSTANCE_ID}, ${now}, ${expiresAt})
      ON CONFLICT ("id") DO UPDATE
        SET "lockedBy"  = ${INSTANCE_ID},
            "lockedAt"  = ${now},
            "expiresAt" = ${expiresAt}
        WHERE "DistributedLock"."expiresAt" < ${now}
    `;
    return result > 0;
  } catch {
    return false;
  }
}

/**
 * Release a lock (only if we still own it).
 */
export async function releaseLock(lockId: string): Promise<void> {
  try {
    await prisma.distributedLock.deleteMany({
      where: { id: lockId, lockedBy: INSTANCE_ID },
    });
  } catch {
    // best-effort
  }
}

/**
 * Execute a function while holding a distributed lock.
 * If the lock cannot be acquired, the function is skipped silently.
 */
export async function withLock<T>(
  lockId: string,
  fn: () => Promise<T>,
  ttlMs: number = 60_000,
): Promise<T | undefined> {
  const acquired = await acquireLock(lockId, ttlMs);
  if (!acquired) return undefined;

  try {
    return await fn();
  } finally {
    await releaseLock(lockId);
  }
}
