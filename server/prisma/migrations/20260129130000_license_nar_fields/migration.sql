-- Add license suffix and NAR member ID fields

ALTER TABLE "AgentProfileSettings"
  ADD COLUMN IF NOT EXISTS "licenseSuffix" TEXT,
  ADD COLUMN IF NOT EXISTS "narMemberId" TEXT;
