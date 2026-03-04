/*
  Warnings:

  - You are about to drop the column `message` on the `MarketingBlast` table. All the data in the column will be lost.
  - You are about to drop the column `targetChannels` on the `MarketingBlast` table. All the data in the column will be lost.
  - The `status` column on the `MarketingBlast` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `MarketingChannel` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BlastPlaybook" AS ENUM ('NEW_LISTING', 'PRICE_REDUCTION', 'OPEN_HOUSE', 'UNDER_CONTRACT', 'JUST_SOLD', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BlastChannelType" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'EMAIL', 'SMS', 'WEBSITE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BlastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey
ALTER TABLE "MarketingBlast" DROP CONSTRAINT IF EXISTS "MarketingBlast_listingId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingChannel" DROP CONSTRAINT IF EXISTS "MarketingChannel_agentId_fkey";

-- AlterTable
ALTER TABLE "MarketingBlast" DROP COLUMN IF EXISTS "message";
ALTER TABLE "MarketingBlast" DROP COLUMN IF EXISTS "targetChannels";
ALTER TABLE "MarketingBlast" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MarketingBlast" ADD COLUMN IF NOT EXISTS "playbook" "BlastPlaybook" NOT NULL DEFAULT 'NEW_LISTING';
ALTER TABLE "MarketingBlast" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "MarketingBlast" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MarketingBlast" ALTER COLUMN "listingId" DROP NOT NULL;
ALTER TABLE "MarketingBlast" DROP COLUMN IF EXISTS "status";
ALTER TABLE "MarketingBlast" ADD COLUMN IF NOT EXISTS "status" "BlastStatus" NOT NULL DEFAULT 'DRAFT';

-- DropTable
DROP TABLE IF EXISTS "MarketingChannel";

-- DropEnum
DROP TYPE IF EXISTS "MarketingBlastStatus";

-- DropEnum
DROP TYPE IF EXISTS "MarketingChannelType";

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlastChannel" (
    "id" TEXT NOT NULL,
    "blastId" TEXT NOT NULL,
    "channel" "BlastChannelType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "BlastStatus" NOT NULL DEFAULT 'DRAFT',
    "previewText" TEXT,
    "previewHtml" TEXT,
    "shortCode" TEXT,
    "shortUrl" TEXT,
    "externalId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlastChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlastHit" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "BlastHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
  CREATE UNIQUE INDEX IF NOT EXISTS "BlastChannel_shortCode_key" ON "BlastChannel"("shortCode");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MarketingBlast" ADD CONSTRAINT "MarketingBlast_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BlastChannel" ADD CONSTRAINT "BlastChannel_blastId_fkey" FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BlastHit" ADD CONSTRAINT "BlastHit_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "BlastChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
