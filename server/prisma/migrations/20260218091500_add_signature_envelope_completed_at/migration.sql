ALTER TABLE "SignatureEnvelope"
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "SignatureEnvelope" se
SET "completedAt" = signed_info.max_signed_at
FROM (
  SELECT
    s."envelopeId",
    MAX(s."signedAt") AS max_signed_at,
    SUM(CASE WHEN s."signedAt" IS NULL THEN 1 ELSE 0 END) AS unsigned_count
  FROM "Signer" s
  GROUP BY s."envelopeId"
) signed_info
WHERE se.id = signed_info."envelopeId"
  AND signed_info.unsigned_count = 0
  AND signed_info.max_signed_at IS NOT NULL
  AND se."completedAt" IS NULL;
