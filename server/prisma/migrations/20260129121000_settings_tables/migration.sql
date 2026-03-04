-- Add missing settings tables for notifications and AI

DO $$ BEGIN
  CREATE TYPE "AiAssistanceLevel" AS ENUM ('OFF', 'LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AgentNotificationPrefs" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "deadlineEmails" BOOLEAN NOT NULL DEFAULT true,
  "dailyPlanEnabled" BOOLEAN NOT NULL DEFAULT true,
  "dailyPlanTime" TEXT NOT NULL DEFAULT '07:00',
  "inAppBanners" BOOLEAN NOT NULL DEFAULT true,
  "signatureAlerts" BOOLEAN NOT NULL DEFAULT true,
  "documentComplete" BOOLEAN NOT NULL DEFAULT true,
  "marketingSummaries" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentNotificationPrefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentNotificationPrefs_agentId_key" ON "AgentNotificationPrefs" ("agentId");

CREATE TABLE IF NOT EXISTS "AgentAiSettings" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "level" "AiAssistanceLevel" NOT NULL DEFAULT 'MEDIUM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentAiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentAiSettings_agentId_key" ON "AgentAiSettings" ("agentId");

DO $$ BEGIN
  ALTER TABLE "AgentNotificationPrefs"
    ADD CONSTRAINT "AgentNotificationPrefs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentAiSettings"
    ADD CONSTRAINT "AgentAiSettings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
