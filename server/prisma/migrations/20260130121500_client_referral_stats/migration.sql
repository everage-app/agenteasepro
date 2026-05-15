-- Add referral stats columns to Client

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "referralsGiven" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "referralsClosed" INTEGER NOT NULL DEFAULT 0;
