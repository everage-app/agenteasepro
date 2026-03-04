-- Create missing IDX connection and automation tables, and add missing LandingPage columns

DO $$ BEGIN
  CREATE TYPE "IdxProviderType" AS ENUM ('UTAH_RESO_WEBAPI', 'GENERIC_API');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "IdxConnection" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "providerType" "IdxProviderType" NOT NULL,
  "vendorName" TEXT,
  "baseUrl" TEXT NOT NULL,
  "clientId" TEXT,
  "clientSecret" TEXT,
  "serverToken" TEXT,
  "browserToken" TEXT,
  "apiKey" TEXT,
  "mlsAgentIds" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdxConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdxConnection_agentId_key" ON "IdxConnection" ("agentId");

DO $$ BEGIN
  ALTER TABLE "IdxConnection"
    ADD CONSTRAINT "IdxConnection_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationEventType" AS ENUM ('LISTING_CREATED', 'DEAL_CREATED', 'REPC_CREATED', 'MARKETING_BLAST_SENT', 'CLIENT_STAGE_CHANGED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventType" "AutomationEventType" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutomationRule_agentId_eventType_isEnabled_idx" ON "AutomationRule" ("agentId", "eventType", "isEnabled");

DO $$ BEGIN
  ALTER TABLE "AutomationRule"
    ADD CONSTRAINT "AutomationRule_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "templateId" TEXT NOT NULL DEFAULT 'design-67';
