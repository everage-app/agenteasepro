-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingEmailEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'sendgrid',
  "eventType" TEXT NOT NULL,
  "email" TEXT,
  "messageId" TEXT,
  "url" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "meta" JSONB,

  "agentId" TEXT,
  "blastId" TEXT,
  "channelId" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingEmailEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_createdAt_idx" ON "MarketingEmailEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_agentId_occurredAt_idx" ON "MarketingEmailEvent"("agentId", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_blastId_occurredAt_idx" ON "MarketingEmailEvent"("blastId", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_channelId_occurredAt_idx" ON "MarketingEmailEvent"("channelId", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_eventType_occurredAt_idx" ON "MarketingEmailEvent"("eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_messageId_idx" ON "MarketingEmailEvent"("messageId");

-- Foreign Keys
DO $$
BEGIN
  ALTER TABLE "MarketingEmailEvent"
    ADD CONSTRAINT "MarketingEmailEvent_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketingEmailEvent"
    ADD CONSTRAINT "MarketingEmailEvent_blastId_fkey"
    FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketingEmailEvent"
    ADD CONSTRAINT "MarketingEmailEvent_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "BlastChannel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
