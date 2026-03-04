import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const DEFAULT_VERSION = '2026-02-25';
const DEFAULT_TERMS_URL = process.env.PUBLIC_TERMS_URL || 'https://app.agenteasepro.com/legal/terms.html';
const DEFAULT_PRIVACY_URL = process.env.PUBLIC_PRIVACY_URL || 'https://app.agenteasepro.com/legal/privacy.html';

export type LegalPolicies = {
  terms: { url: string; version: string };
  privacy: { url: string; version: string };
};

function ensureAbsoluteUrl(value: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export async function getLegalPolicies(): Promise<LegalPolicies> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LegalPolicy" ("policyKey", "url", "version")
    VALUES ('terms', ${DEFAULT_TERMS_URL}, ${DEFAULT_VERSION})
    ON CONFLICT ("policyKey") DO NOTHING
  `);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LegalPolicy" ("policyKey", "url", "version")
    VALUES ('privacy', ${DEFAULT_PRIVACY_URL}, ${DEFAULT_VERSION})
    ON CONFLICT ("policyKey") DO NOTHING
  `);

  const rows = await prisma.$queryRaw<Array<{ policyKey: string; url: string; version: string }>>(Prisma.sql`
    SELECT "policyKey", "url", "version"
    FROM "LegalPolicy"
    WHERE "policyKey" IN ('terms', 'privacy')
  `);

  const terms = rows.find((r) => r.policyKey === 'terms');
  const privacy = rows.find((r) => r.policyKey === 'privacy');

  return {
    terms: {
      url: terms?.url || DEFAULT_TERMS_URL,
      version: terms?.version || DEFAULT_VERSION,
    },
    privacy: {
      url: privacy?.url || DEFAULT_PRIVACY_URL,
      version: privacy?.version || DEFAULT_VERSION,
    },
  };
}

export async function updateLegalPolicies(
  input: LegalPolicies,
  updater?: { id?: string; name?: string },
): Promise<LegalPolicies> {
  const termsUrl = ensureAbsoluteUrl(input.terms.url) || DEFAULT_TERMS_URL;
  const privacyUrl = ensureAbsoluteUrl(input.privacy.url) || DEFAULT_PRIVACY_URL;
  const termsVersion = (input.terms.version || DEFAULT_VERSION).trim();
  const privacyVersion = (input.privacy.version || DEFAULT_VERSION).trim();

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LegalPolicy" ("policyKey", "url", "version", "updatedByAgentId", "updatedByAgentName")
    VALUES ('terms', ${termsUrl}, ${termsVersion}, ${updater?.id || null}, ${updater?.name || null})
    ON CONFLICT ("policyKey")
    DO UPDATE SET
      "url" = EXCLUDED."url",
      "version" = EXCLUDED."version",
      "updatedAt" = CURRENT_TIMESTAMP,
      "updatedByAgentId" = EXCLUDED."updatedByAgentId",
      "updatedByAgentName" = EXCLUDED."updatedByAgentName"
  `);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LegalPolicy" ("policyKey", "url", "version", "updatedByAgentId", "updatedByAgentName")
    VALUES ('privacy', ${privacyUrl}, ${privacyVersion}, ${updater?.id || null}, ${updater?.name || null})
    ON CONFLICT ("policyKey")
    DO UPDATE SET
      "url" = EXCLUDED."url",
      "version" = EXCLUDED."version",
      "updatedAt" = CURRENT_TIMESTAMP,
      "updatedByAgentId" = EXCLUDED."updatedByAgentId",
      "updatedByAgentName" = EXCLUDED."updatedByAgentName"
  `);

  return getLegalPolicies();
}

export async function getAgentLegalAcceptance(agentId: string) {
  const rows = await prisma.$queryRaw<Array<{
    termsAcceptedAt: Date | null;
    privacyAcceptedAt: Date | null;
    termsVersionAccepted: string | null;
    privacyVersionAccepted: string | null;
    termsUrlAccepted: string | null;
    privacyUrlAccepted: string | null;
    legalAcceptedIp: string | null;
    legalAcceptedUserAgent: string | null;
  }>>(Prisma.sql`
    SELECT
      "termsAcceptedAt",
      "privacyAcceptedAt",
      "termsVersionAccepted",
      "privacyVersionAccepted",
      "termsUrlAccepted",
      "privacyUrlAccepted",
      "legalAcceptedIp",
      "legalAcceptedUserAgent"
    FROM "Agent"
    WHERE "id" = ${agentId}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    termsAcceptedAt: row.termsAcceptedAt ? new Date(row.termsAcceptedAt).toISOString() : null,
    privacyAcceptedAt: row.privacyAcceptedAt ? new Date(row.privacyAcceptedAt).toISOString() : null,
    termsVersionAccepted: row.termsVersionAccepted,
    privacyVersionAccepted: row.privacyVersionAccepted,
    termsUrlAccepted: row.termsUrlAccepted,
    privacyUrlAccepted: row.privacyUrlAccepted,
    legalAcceptedIp: row.legalAcceptedIp,
    legalAcceptedUserAgent: row.legalAcceptedUserAgent,
  };
}

export async function recordAgentLegalAcceptance(
  agentId: string,
  policies: LegalPolicies,
  context?: { ip?: string; userAgent?: string },
) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Agent"
    SET
      "termsAcceptedAt" = CURRENT_TIMESTAMP,
      "privacyAcceptedAt" = CURRENT_TIMESTAMP,
      "termsVersionAccepted" = ${policies.terms.version},
      "privacyVersionAccepted" = ${policies.privacy.version},
      "termsUrlAccepted" = ${policies.terms.url},
      "privacyUrlAccepted" = ${policies.privacy.url},
      "legalAcceptedIp" = ${context?.ip || null},
      "legalAcceptedUserAgent" = ${context?.userAgent || null}
    WHERE "id" = ${agentId}
  `);
}
