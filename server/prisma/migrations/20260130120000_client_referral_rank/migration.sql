-- Add referral rank enum and column to Client

DO $$ BEGIN
  CREATE TYPE "ReferralRank" AS ENUM ('A', 'B', 'C');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "referralRank" "ReferralRank" NOT NULL DEFAULT 'C';
