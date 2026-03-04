-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('BUYER', 'SELLER', 'BOTH');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('LEAD', 'ACTIVE', 'OFFER_SENT', 'UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED', 'CLOSED', 'FELL_THROUGH');

-- CreateEnum
CREATE TYPE "PossessionTiming" AS ENUM ('ON_RECORDING', 'HOURS_AFTER_RECORDING', 'DAYS_AFTER_RECORDING');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('SELLER', 'BUYER', 'SPLIT', 'OTHER');

-- CreateEnum
CREATE TYPE "HomeWarrantyOrderedBy" AS ENUM ('BUYER', 'SELLER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Meridiem" AS ENUM ('AM', 'PM');

-- CreateEnum
CREATE TYPE "AddendumType" AS ENUM ('ADDENDUM', 'COUNTEROFFER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_CONTRACT', 'SOLD', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "MarketingChannelType" AS ENUM ('LINKEDIN', 'FACEBOOK', 'X', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketingBlastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');

-- CreateEnum
CREATE TYPE "SignatureEnvelopeType" AS ENUM ('REPC', 'ADDENDUM');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('BUYER', 'SELLER', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('TYPED', 'DRAWN', 'UPLOADED', 'NONE');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brokerageName" TEXT,
    "licenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" "ClientRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "mlsId" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UT',
    "zip" TEXT NOT NULL,
    "taxId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buyerId" TEXT,
    "sellerId" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'LEAD',
    "offerReferenceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repc" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "buyerLegalNames" TEXT NOT NULL,
    "sellerLegalNames" TEXT NOT NULL,
    "earnestMoneyAmount" DECIMAL(65,30) NOT NULL,
    "earnestMoneyForm" TEXT NOT NULL,
    "additionalEarnestMoneyAmount" DECIMAL(65,30),
    "propertyCity" TEXT NOT NULL,
    "propertyCounty" TEXT NOT NULL,
    "propertyState" TEXT NOT NULL,
    "propertyZip" TEXT NOT NULL,
    "propertyTaxId" TEXT NOT NULL,
    "otherIncludedItems" TEXT NOT NULL,
    "excludedItems" TEXT NOT NULL,
    "waterRightsIncludedNotes" TEXT,
    "waterRightsExcludedNotes" TEXT,
    "purchasePrice" DECIMAL(65,30) NOT NULL,
    "newLoanAmount" DECIMAL(65,30),
    "sellerFinancingAmount" DECIMAL(65,30),
    "cashAtSettlement" DECIMAL(65,30),
    "isSubjectToSaleOfBuyersProperty" BOOLEAN NOT NULL,
    "buyersPropertyDescription" TEXT,
    "possessionTiming" "PossessionTiming" NOT NULL,
    "possessionOffset" INTEGER,
    "capitalImprovementsPayer" "PayerType" NOT NULL,
    "capitalImprovementsPayerOther" TEXT,
    "changeOfOwnershipFeePayer" "PayerType" NOT NULL,
    "changeOfOwnershipFeePayerOther" TEXT,
    "sellerCompensationContributionPercent" DECIMAL(65,30),
    "sellerCompensationContributionFlat" DECIMAL(65,30),
    "hasDueDiligenceCondition" BOOLEAN NOT NULL,
    "hasAppraisalCondition" BOOLEAN NOT NULL,
    "hasFinancingCondition" BOOLEAN NOT NULL,
    "sellerDisclosureDeadline" TIMESTAMP(3) NOT NULL,
    "dueDiligenceDeadline" TIMESTAMP(3) NOT NULL,
    "financingAppraisalDeadline" TIMESTAMP(3) NOT NULL,
    "settlementDeadline" TIMESTAMP(3) NOT NULL,
    "hasHomeWarranty" BOOLEAN NOT NULL,
    "homeWarrantyOrderedBy" "HomeWarrantyOrderedBy" NOT NULL,
    "homeWarrantyMaxCost" DECIMAL(65,30),
    "offerExpirationDate" TIMESTAMP(3) NOT NULL,
    "offerExpirationTime" TEXT NOT NULL,
    "offerExpirationMeridiem" "Meridiem" NOT NULL,
    "rawJson" JSONB NOT NULL,

    CONSTRAINT "Repc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addendum" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "AddendumType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "offerReferenceDate" TIMESTAMP(3) NOT NULL,
    "buyerLabel" TEXT NOT NULL,
    "sellerLabel" TEXT NOT NULL,
    "propertySummary" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "expirationTime" TEXT,
    "expirationMeridiem" "Meridiem",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dealId" TEXT,
    "mlsId" TEXT,
    "headline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "primaryImageUrl" TEXT,
    "price" DECIMAL(65,30),
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingChannel" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "MarketingChannelType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "oauthProvider" TEXT,
    "metadata" JSONB,

    CONSTRAINT "MarketingChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingBlast" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetChannels" JSONB NOT NULL,
    "status" "MarketingBlastStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MarketingBlast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEnvelope" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "SignatureEnvelopeType" NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "contractSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "role" "SignerRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatureType" "SignatureType" NOT NULL DEFAULT 'NONE',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signatureData" JSONB,
    "auditHash" TEXT,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "officialPdfPath" TEXT NOT NULL,
    "schemaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormInstance" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "formDefinitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Repc_dealId_key" ON "Repc"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "FormDefinition_code_key" ON "FormDefinition"("code");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repc" ADD CONSTRAINT "Repc_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addendum" ADD CONSTRAINT "Addendum_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannel" ADD CONSTRAINT "MarketingChannel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingBlast" ADD CONSTRAINT "MarketingBlast_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingBlast" ADD CONSTRAINT "MarketingBlast_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEnvelope" ADD CONSTRAINT "SignatureEnvelope_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signer" ADD CONSTRAINT "Signer_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "SignatureEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
