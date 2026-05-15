-- AlterTable
ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedByAgentId" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveAfterDays" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

-- Index for fast active/archive filtering by agent + status
CREATE INDEX IF NOT EXISTS "Deal_agentId_archivedAt_status_idx" ON "Deal"("agentId", "archivedAt", "status");
