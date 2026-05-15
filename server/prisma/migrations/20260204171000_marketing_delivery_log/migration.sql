-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingDeliveryLog" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "blastId" TEXT NOT NULL,
  "channelId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'sendgrid',
  "status" TEXT NOT NULL,
  "messageId" TEXT,
  "subject" TEXT NOT NULL,
  "recipientsCount" INTEGER NOT NULL DEFAULT 0,
  "recipientsSample" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "audienceType" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_agentId_createdAt_idx" ON "MarketingDeliveryLog"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_blastId_createdAt_idx" ON "MarketingDeliveryLog"("blastId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_channelId_createdAt_idx" ON "MarketingDeliveryLog"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_status_createdAt_idx" ON "MarketingDeliveryLog"("status", "createdAt");

-- Foreign Keys
DO $$
BEGIN
  ALTER TABLE "MarketingDeliveryLog"
    ADD CONSTRAINT "MarketingDeliveryLog_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketingDeliveryLog"
    ADD CONSTRAINT "MarketingDeliveryLog_blastId_fkey"
    FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketingDeliveryLog"
    ADD CONSTRAINT "MarketingDeliveryLog_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "BlastChannel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
