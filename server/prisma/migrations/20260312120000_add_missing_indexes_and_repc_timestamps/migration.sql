-- Add createdAt/updatedAt to Repc (non-destructive for existing rows)
ALTER TABLE "Repc" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Repc" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Missing FK indexes on Deal
CREATE INDEX IF NOT EXISTS "Deal_propertyId_idx" ON "Deal"("propertyId");
CREATE INDEX IF NOT EXISTS "Deal_buyerId_idx" ON "Deal"("buyerId");
CREATE INDEX IF NOT EXISTS "Deal_sellerId_idx" ON "Deal"("sellerId");

-- Missing FK indexes on Addendum
CREATE INDEX IF NOT EXISTS "Addendum_dealId_idx" ON "Addendum"("dealId");

-- Missing FK indexes on SignatureEnvelope
CREATE INDEX IF NOT EXISTS "SignatureEnvelope_dealId_idx" ON "SignatureEnvelope"("dealId");

-- Missing FK index on Signer
CREATE INDEX IF NOT EXISTS "Signer_envelopeId_idx" ON "Signer"("envelopeId");

-- Missing FK indexes on FormInstance
CREATE INDEX IF NOT EXISTS "FormInstance_dealId_idx" ON "FormInstance"("dealId");
CREATE INDEX IF NOT EXISTS "FormInstance_formDefinitionId_idx" ON "FormInstance"("formDefinitionId");

-- Missing FK index on BlastChannel
CREATE INDEX IF NOT EXISTS "BlastChannel_blastId_idx" ON "BlastChannel"("blastId");

-- Missing FK index on BlastHit
CREATE INDEX IF NOT EXISTS "BlastHit_channelId_idx" ON "BlastHit"("channelId");

-- Missing FK index on SupportRequest
CREATE INDEX IF NOT EXISTS "SupportRequest_agentId_idx" ON "SupportRequest"("agentId");
