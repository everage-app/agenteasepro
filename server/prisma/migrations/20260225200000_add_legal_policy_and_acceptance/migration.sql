-- Add legal policy config and per-agent acceptance tracking

ALTER TABLE "Agent"
ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "termsVersionAccepted" TEXT,
ADD COLUMN IF NOT EXISTS "privacyVersionAccepted" TEXT,
ADD COLUMN IF NOT EXISTS "termsUrlAccepted" TEXT,
ADD COLUMN IF NOT EXISTS "privacyUrlAccepted" TEXT,
ADD COLUMN IF NOT EXISTS "legalAcceptedIp" TEXT,
ADD COLUMN IF NOT EXISTS "legalAcceptedUserAgent" TEXT;

CREATE TABLE IF NOT EXISTS "LegalPolicy" (
  "policyKey" TEXT PRIMARY KEY,
  "url" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByAgentId" TEXT,
  "updatedByAgentName" TEXT
);

INSERT INTO "LegalPolicy" ("policyKey", "url", "version")
VALUES
  ('terms', 'https://app.agenteasepro.com/legal/terms.html', '2026-02-25'),
  ('privacy', 'https://app.agenteasepro.com/legal/privacy.html', '2026-02-25')
ON CONFLICT ("policyKey") DO NOTHING;
