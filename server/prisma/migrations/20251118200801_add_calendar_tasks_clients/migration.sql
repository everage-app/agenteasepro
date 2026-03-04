-- CreateEnum
CREATE TYPE "ClientStage" AS ENUM ('NEW', 'ACTIVE', 'UNDER_CONTRACT', 'CLOSED', 'LOST');

-- CreateEnum
CREATE TYPE "DealEventType" AS ENUM ('SELLER_DISCLOSURE_DEADLINE', 'DUE_DILIGENCE_DEADLINE', 'FINANCING_DEADLINE', 'APPRAISAL_DEADLINE', 'SETTLEMENT_DEADLINE', 'POSSESSION', 'OTHER');

-- CreateEnum
CREATE TYPE "EventCreatedFrom" AS ENUM ('REPC', 'ADDENDUM', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "TaskCreatedFrom" AS ENUM ('MANUAL', 'AI_SUGGESTED', 'SYSTEM');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "leadSource" TEXT,
ADD COLUMN     "stage" "ClientStage" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "DealEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdFrom" "EventCreatedFrom" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dealId" TEXT,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdFrom" "TaskCreatedFrom" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
