-- Add Stripe billing fields to Agent table

DO $$ BEGIN
  CREATE TYPE "BillingMode" AS ENUM ('STANDARD', 'FREE', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "billingMode" "BillingMode" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "billingCustomPriceCents" INTEGER;
