-- Add notes column to Client

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
