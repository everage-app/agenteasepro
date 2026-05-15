-- Hotfix migration: ensure Agent status/billing columns exist in production

DO $$ BEGIN
  CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
