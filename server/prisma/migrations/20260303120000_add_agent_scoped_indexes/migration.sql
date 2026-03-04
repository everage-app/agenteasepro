-- CreateIndex
CREATE INDEX IF NOT EXISTS "Property_agentId_createdAt_idx" ON "Property"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Property_agentId_mlsId_idx" ON "Property"("agentId", "mlsId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_agentId_status_idx" ON "Listing"("agentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_agentId_createdAt_idx" ON "Listing"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingBlast_agentId_status_idx" ON "MarketingBlast"("agentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingBlast_agentId_scheduledAt_idx" ON "MarketingBlast"("agentId", "scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingBlast_agentId_sentAt_idx" ON "MarketingBlast"("agentId", "sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingBlast_agentId_createdAt_idx" ON "MarketingBlast"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealEvent_agentId_dealId_idx" ON "DealEvent"("agentId", "dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealEvent_agentId_date_idx" ON "DealEvent"("agentId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealEvent_agentId_createdAt_idx" ON "DealEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_agentId_status_idx" ON "Task"("agentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_agentId_dueAt_idx" ON "Task"("agentId", "dueAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_agentId_createdAt_idx" ON "Task"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_agentId_stage_idx" ON "Client"("agentId", "stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_agentId_lastContactAt_idx" ON "Client"("agentId", "lastContactAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_agentId_createdAt_idx" ON "Client"("agentId", "createdAt");
