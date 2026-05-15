-- CreateTable
CREATE TABLE "MlsListing" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "listingId" TEXT,
    "mlsNumber" TEXT NOT NULL,
    "headline" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "price" DECIMAL(65,30),
    "beds" DOUBLE PRECISION,
    "baths" DOUBLE PRECISION,
    "squareFeet" INTEGER,
    "lotSize" DOUBLE PRECISION,
    "yearBuilt" INTEGER,
    "description" TEXT,
    "photos" JSONB,
    "raw" JSONB,
    "sourceUrl" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MlsListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MlsListing_agentId_mlsNumber_key" ON "MlsListing"("agentId", "mlsNumber");

-- AddForeignKey
ALTER TABLE "MlsListing" ADD CONSTRAINT "MlsListing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MlsListing" ADD CONSTRAINT "MlsListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
