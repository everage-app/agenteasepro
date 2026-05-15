-- Add email verification columns to Agent
ALTER TABLE "Agent" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "emailVerifyToken" TEXT;
ALTER TABLE "Agent" ADD COLUMN "emailVerifyExpiry" TIMESTAMP(3);

-- Mark ALL existing agents as verified (they were already using the system)
UPDATE "Agent" SET "emailVerified" = true;
