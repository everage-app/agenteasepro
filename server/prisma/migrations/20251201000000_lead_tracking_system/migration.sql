-- Lead Tracking & Analytics Enhancement
-- Add comprehensive lead tracking, landing pages, and analytics

-- Lead Source tracking
CREATE TYPE "LeadSource" AS ENUM (
  'WEBSITE',
  'LANDING_PAGE',
  'ZILLOW',
  'REALTOR_COM',
  'FACEBOOK',
  'INSTAGRAM',
  'GOOGLE_ADS',
  'EMAIL',
  'DIRECT',
  'REFERRAL',
  'OTHER'
);

-- Lead Priority levels
CREATE TYPE "LeadPriority" AS ENUM (
  'HOT',
  'WARM',
  'COLD',
  'DEAD'
);

-- Landing Pages for listings
CREATE TABLE "LandingPage" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "listingId" TEXT,
  "slug" TEXT NOT NULL,
  "customDomain" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "heroImage" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "totalViews" INTEGER NOT NULL DEFAULT 0,
  "uniqueViews" INTEGER NOT NULL DEFAULT 0,
  "leadsGenerated" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- Page Views / Visits tracking
CREATE TABLE "PageView" (
  "id" TEXT NOT NULL,
  "landingPageId" TEXT,
  "listingId" TEXT,
  "visitorId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "referrer" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "utmTerm" TEXT,
  "country" TEXT,
  "city" TEXT,
  "region" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "duration" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- Enhanced Lead table
CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "clientId" TEXT,
  "listingId" TEXT,
  "landingPageId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
  "priority" "LeadPriority" NOT NULL DEFAULT 'WARM',
  "averagePrice" INTEGER,
  "homesViewed" INTEGER NOT NULL DEFAULT 0,
  "lastVisit" TIMESTAMP(3),
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "lastContact" TIMESTAMP(3),
  "nextTask" TEXT,
  "assignedTo" TEXT,
  "notes" TEXT,
  "tags" TEXT[],
  "converted" BOOLEAN NOT NULL DEFAULT false,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Lead Activity / Engagement tracking
CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "activityType" TEXT NOT NULL,
  "listingId" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "LandingPage_agentId_idx" ON "LandingPage"("agentId");
CREATE INDEX "LandingPage_listingId_idx" ON "LandingPage"("listingId");
CREATE INDEX "LandingPage_slug_idx" ON "LandingPage"("slug");
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

CREATE INDEX "PageView_landingPageId_idx" ON "PageView"("landingPageId");
CREATE INDEX "PageView_listingId_idx" ON "PageView"("listingId");
CREATE INDEX "PageView_visitorId_idx" ON "PageView"("visitorId");
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

CREATE INDEX "Lead_agentId_idx" ON "Lead"("agentId");
CREATE INDEX "Lead_listingId_idx" ON "Lead"("listingId");
CREATE INDEX "Lead_landingPageId_idx" ON "Lead"("landingPageId");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

-- Foreign Keys
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
