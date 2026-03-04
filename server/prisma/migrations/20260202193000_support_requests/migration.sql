-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('GENERAL', 'SUGGESTION', 'BILLING', 'BUG');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "pagePath" TEXT,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "internalNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_agentId_createdAt_idx" ON "SupportRequest"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_category_createdAt_idx" ON "SupportRequest"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
