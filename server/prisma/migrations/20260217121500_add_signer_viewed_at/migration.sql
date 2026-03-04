ALTER TABLE "Signer"
ADD COLUMN "viewedAt" TIMESTAMP(3);

UPDATE "Signer"
SET "viewedAt" = "signedAt"
WHERE "signedAt" IS NOT NULL AND "viewedAt" IS NULL;
