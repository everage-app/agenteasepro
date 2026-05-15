-- CreateTable
CREATE TABLE "ContactEmailTemplate" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactEmailTemplate_agentId_createdAt_idx" ON "ContactEmailTemplate"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactEmailTemplate_agentId_name_key" ON "ContactEmailTemplate"("agentId", "name");

-- AddForeignKey
ALTER TABLE "ContactEmailTemplate" ADD CONSTRAINT "ContactEmailTemplate_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
