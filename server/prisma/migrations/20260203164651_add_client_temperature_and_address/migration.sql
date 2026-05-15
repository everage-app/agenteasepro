/*
  Warnings:

  - The values [DRAFT] on the enum `ListingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `price` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - Made the column `price` on table `Listing` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
-- CREATE TYPE "ClientTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterEnum
-- BEGIN;
-- CREATE TYPE "ListingStatus_new" AS ENUM ('ACTIVE', 'PENDING', 'UNDER_CONTRACT', 'SOLD', 'OFF_MARKET');
-- ALTER TABLE "Listing" ALTER COLUMN "status" DROP DEFAULT;
-- ALTER TABLE "Listing" ALTER COLUMN "status" TYPE "ListingStatus_new" USING ("status"::text::"ListingStatus_new");
-- ALTER TYPE "ListingStatus" RENAME TO "ListingStatus_old";
-- ALTER TYPE "ListingStatus_new" RENAME TO "ListingStatus";
-- DROP TYPE "ListingStatus_old";
-- ALTER TABLE "Listing" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
-- COMMIT;

-- AlterEnum
-- ALTER TYPE "TaskCreatedFrom" ADD VALUE 'AUTOMATION'; -- Skipped: Already exists in production

-- DropForeignKey
ALTER TABLE "LandingPage" DROP CONSTRAINT IF EXISTS "LandingPage_agentId_fkey";

-- DropForeignKey
ALTER TABLE "LandingPage" DROP CONSTRAINT IF EXISTS "LandingPage_listingId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_agentId_fkey";

-- DropForeignKey
ALTER TABLE "LeadActivity" DROP CONSTRAINT IF EXISTS "LeadActivity_leadId_fkey";

-- DropForeignKey
ALTER TABLE "PageView" DROP CONSTRAINT IF EXISTS "PageView_landingPageId_fkey";

-- DropForeignKey
ALTER TABLE "PageView" DROP CONSTRAINT IF EXISTS "PageView_listingId_fkey";

-- DropForeignKey
ALTER TABLE "SupportRequest" DROP CONSTRAINT IF EXISTS "SupportRequest_agentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "LandingPage_slug_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupportRequest_agentId_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupportRequest_category_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupportRequest_status_createdAt_idx";

-- AlterTable
ALTER TABLE "AgentAiSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentNotificationPrefs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentProfileSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AutomationRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "mailingAddress" TEXT,
ADD COLUMN     "mailingCity" TEXT,
ADD COLUMN     "mailingState" TEXT,
ADD COLUMN     "mailingZip" TEXT,
ADD COLUMN     "temperature" "ClientTemperature" NOT NULL DEFAULT 'COLD';

-- AlterTable
ALTER TABLE "DailyActivity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IdxConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Listing" ALTER COLUMN "price" SET NOT NULL,
ALTER COLUMN "price" SET DATA TYPE INTEGER,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "addressLine1" DROP DEFAULT,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "zipCode" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "listingId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCriteria" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "minBeds" INTEGER,
    "minBaths" DOUBLE PRECISION,
    "cities" TEXT[],
    "zipCodes" TEXT[],
    "propertyTypes" TEXT[],
    "lastAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_agentId_key" ON "GoogleCalendarConnection"("agentId");

-- CreateIndex
CREATE INDEX "SavedListing_clientId_idx" ON "SavedListing"("clientId");

-- CreateIndex
CREATE INDEX "SavedListing_leadId_idx" ON "SavedListing"("leadId");

-- CreateIndex
CREATE INDEX "SavedListing_listingId_idx" ON "SavedListing"("listingId");

-- CreateIndex
CREATE INDEX "SearchCriteria_clientId_idx" ON "SearchCriteria"("clientId");

-- CreateIndex
CREATE INDEX "SearchCriteria_leadId_idx" ON "SearchCriteria"("leadId");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfileSettings" ADD CONSTRAINT "AgentProfileSettings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchCriteria" ADD CONSTRAINT "SearchCriteria_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchCriteria" ADD CONSTRAINT "SearchCriteria_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
