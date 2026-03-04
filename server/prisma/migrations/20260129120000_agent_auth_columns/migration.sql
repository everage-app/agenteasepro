-- Add auth columns to Agent table

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
