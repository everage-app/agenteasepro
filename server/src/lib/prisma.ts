import { PrismaClient } from '@prisma/client';

declare const globalThis: {
  prismaGlobal?: PrismaClient;
} & typeof global;

const databaseUrl = process.env.DATABASE_URL || '';
const pooledDatabaseUrl = process.env.DATABASE_CONNECTION_POOL_URL || '';
const usePoolUrl = process.env.AEP_USE_DATABASE_POOL_URL === 'true' && Boolean(pooledDatabaseUrl);
const baseDatabaseUrl = usePoolUrl ? pooledDatabaseUrl : databaseUrl;

const hasConnectionLimit = /[?&]connection_limit=\d+/i.test(baseDatabaseUrl);
const hasPoolHint = /[?&]pgbouncer=true/i.test(baseDatabaseUrl)
  || /pgbouncer|pool/i.test(baseDatabaseUrl)
  || usePoolUrl;
const shouldApplyHerokuConnectionLimit = process.env.NODE_ENV === 'production'
  && Boolean(process.env.DYNO)
  && Boolean(baseDatabaseUrl)
  && !hasConnectionLimit
  && !hasPoolHint;

function withHerokuConnectionLimit(url: string): string {
  if (!shouldApplyHerokuConnectionLimit) return url;
  const configuredLimit = Number(process.env.AEP_PRISMA_CONNECTION_LIMIT || 5);
  const connectionLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.floor(configuredLimit)
    : 5;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('connection_limit', String(connectionLimit));
    return parsed.toString();
  } catch (error) {
    console.warn('Could not apply Heroku Prisma connection_limit to DATABASE_URL:', error);
    return url;
  }
}

const resolvedDatabaseUrl = withHerokuConnectionLimit(baseDatabaseUrl);

if (
  shouldApplyHerokuConnectionLimit
) {
  console.warn(
    'DATABASE_URL has no explicit connection_limit or pool hint. Applying Prisma connection_limit for this Heroku dyno.',
  );
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient(
  resolvedDatabaseUrl
    ? { datasources: { db: { url: resolvedDatabaseUrl } } }
    : undefined,
);

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
