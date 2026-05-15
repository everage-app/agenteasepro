DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DOCUMENT'
      AND enumtypid = '"SignatureEnvelopeType"'::regtype
  ) THEN
    ALTER TYPE "SignatureEnvelopeType" ADD VALUE 'DOCUMENT';
  END IF;
END $$;

ALTER TABLE "SignatureEnvelope"
  ADD COLUMN IF NOT EXISTS "agentId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentName" TEXT,
  ADD COLUMN IF NOT EXISTS "documentMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "documentData" BYTEA;

UPDATE "SignatureEnvelope" se
SET "agentId" = d."agentId"
FROM "Deal" d
WHERE se."dealId" = d."id"
  AND se."agentId" IS NULL;

ALTER TABLE "SignatureEnvelope"
  ALTER COLUMN "dealId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "SignatureEnvelope_agentId_idx" ON "SignatureEnvelope"("agentId");
