#!/usr/bin/env node

const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const serverRoot = path.join(repoRoot, 'server');

function requireFromServer(packageName) {
  return require(path.join(serverRoot, 'node_modules', packageName));
}

try {
  const dotenv = requireFromServer('dotenv');
  dotenv.config({ path: path.join(repoRoot, '.env'), override: true });
  dotenv.config({ path: path.join(serverRoot, '.env') });
} catch {
  // Heroku and CI provide DATABASE_URL through the process environment.
}

const { PrismaClient } = requireFromServer('@prisma/client');

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const fixDefaults = args.has('--fix-defaults');
const syncAgentBrokerageName = args.has('--sync-agent-brokerage-name');

function asNumber(value) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function redactDatabaseUrl(raw) {
  if (!raw) return 'DATABASE_URL missing';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return 'DATABASE_URL present, unparsable for redaction';
  }
}

async function main() {
  const database = redactDatabaseUrl(process.env.DATABASE_URL);

  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'AgentProfileSettings'
    ) AS "exists"
  `);
  const tableExists = Boolean(tableRows[0]?.exists);

  if (!tableExists) {
    console.log(JSON.stringify({
      status: 'FAIL',
      database,
      tableExists,
      message: 'AgentProfileSettings table is missing. Run existing Prisma migrations first.',
    }, null, 2));
    process.exit(2);
  }

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name AS "columnName", data_type AS "dataType", column_default AS "columnDefault", is_nullable AS "isNullable"
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'AgentProfileSettings'
      AND column_name IN ('brokerageLogoUrl', 'brokerageName', 'brokerageLogoWidth', 'brokerageLogoBackground')
    ORDER BY column_name
  `);
  const columnNames = new Set(columns.map((column) => column.columnName));
  const hasWidth = columnNames.has('brokerageLogoWidth');
  const hasBackground = columnNames.has('brokerageLogoBackground');

  const baseCounts = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS "profileRows",
      COUNT(*) FILTER (WHERE "brokerageLogoUrl" IS NOT NULL AND btrim("brokerageLogoUrl") <> '')::int AS "brokerageLogoRows",
      COUNT(*) FILTER (WHERE "brokerageLogoUrl" LIKE 'data:%')::int AS "inlineLogoRows",
      COUNT(*) FILTER (WHERE "brokerageLogoUrl" LIKE '/uploads/%' OR "brokerageLogoUrl" LIKE 'https://%.s3%.amazonaws.com/%')::int AS "managedLogoRows",
      COUNT(*) FILTER (
        WHERE "brokerageLogoUrl" IS NOT NULL
          AND btrim("brokerageLogoUrl") <> ''
          AND "brokerageLogoUrl" NOT LIKE 'data:%'
          AND "brokerageLogoUrl" NOT LIKE '/uploads/%'
          AND "brokerageLogoUrl" NOT LIKE 'https://%.s3%.amazonaws.com/%'
      )::int AS "externalLogoRows"
    FROM "AgentProfileSettings"
  `);

  let presentationCounts = null;
  let fixes = null;

  if (hasWidth && hasBackground) {
    if (fixDefaults) {
      await prisma.$executeRawUnsafe(`
        UPDATE "AgentProfileSettings"
        SET "brokerageLogoWidth" = 260
        WHERE "brokerageLogoWidth" IS NULL
           OR "brokerageLogoWidth" < 140
           OR "brokerageLogoWidth" > 420
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "AgentProfileSettings"
        SET "brokerageLogoBackground" = 'CARD'
        WHERE "brokerageLogoBackground" IS NULL
           OR "brokerageLogoBackground" NOT IN ('CARD', 'TRANSPARENT')
      `);
      fixes = { normalizedPresentationDefaults: true };
    }

    if (syncAgentBrokerageName) {
      const syncResult = await prisma.$queryRawUnsafe(`
        WITH updated AS (
          UPDATE "Agent" a
          SET "brokerageName" = aps."brokerageName"
          FROM "AgentProfileSettings" aps
          WHERE a."id" = aps."agentId"
            AND aps."brokerageName" IS NOT NULL
            AND btrim(aps."brokerageName") <> ''
            AND COALESCE(a."brokerageName", '') <> aps."brokerageName"
          RETURNING a."id"
        )
        SELECT COUNT(*)::int AS "updatedRows" FROM updated
      `);
      fixes = {
        ...(fixes || {}),
        syncedAgentBrokerageNameRows: asNumber(syncResult[0]?.updatedRows),
      };
    }

    presentationCounts = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) FILTER (WHERE "brokerageLogoWidth" IS NULL OR "brokerageLogoWidth" < 140 OR "brokerageLogoWidth" > 420)::int AS "invalidWidthRows",
        COUNT(*) FILTER (WHERE "brokerageLogoBackground" IS NULL OR "brokerageLogoBackground" NOT IN ('CARD', 'TRANSPARENT'))::int AS "invalidBackgroundRows",
        COUNT(*) FILTER (WHERE "brokerageLogoBackground" = 'TRANSPARENT')::int AS "transparentBackgroundRows",
        COUNT(*) FILTER (WHERE "brokerageLogoBackground" = 'CARD')::int AS "cardBackgroundRows",
        COUNT(*) FILTER (
          WHERE aps."brokerageName" IS NOT NULL
            AND btrim(aps."brokerageName") <> ''
            AND COALESCE(a."brokerageName", '') <> aps."brokerageName"
        )::int AS "agentBrokerageNameMismatchRows"
      FROM "AgentProfileSettings" aps
      JOIN "Agent" a ON a."id" = aps."agentId"
    `);
  }

  const counts = {
    profileRows: asNumber(baseCounts[0]?.profileRows),
    brokerageLogoRows: asNumber(baseCounts[0]?.brokerageLogoRows),
    inlineLogoRows: asNumber(baseCounts[0]?.inlineLogoRows),
    managedLogoRows: asNumber(baseCounts[0]?.managedLogoRows),
    externalLogoRows: asNumber(baseCounts[0]?.externalLogoRows),
    ...(presentationCounts ? {
      invalidWidthRows: asNumber(presentationCounts[0]?.invalidWidthRows),
      invalidBackgroundRows: asNumber(presentationCounts[0]?.invalidBackgroundRows),
      transparentBackgroundRows: asNumber(presentationCounts[0]?.transparentBackgroundRows),
      cardBackgroundRows: asNumber(presentationCounts[0]?.cardBackgroundRows),
      agentBrokerageNameMismatchRows: asNumber(presentationCounts[0]?.agentBrokerageNameMismatchRows),
    } : {}),
  };

  const status = hasWidth && hasBackground && counts.invalidWidthRows === 0 && counts.invalidBackgroundRows === 0
    ? 'PASS'
    : 'FAIL';

  console.log(JSON.stringify({
    status,
    database,
    tableExists,
    columns,
    counts,
    fixes,
    notes: [
      'This audit never prints brokerage image URLs or DATABASE_URL credentials.',
      'Existing brokerageLogoUrl values are preserved by the migration; image deletion only occurs when a user uploads a replacement or explicitly removes the logo.',
      'inlineLogoRows are valid when production is configured to inline settings images instead of using S3.',
    ],
  }, null, 2));

  if (status !== 'PASS') process.exit(2);
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      status: 'ERROR',
      message: error?.message || String(error),
    }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });