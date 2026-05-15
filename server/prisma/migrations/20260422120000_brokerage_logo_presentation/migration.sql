ALTER TABLE "AgentProfileSettings"
ADD COLUMN IF NOT EXISTS "brokerageLogoWidth" INTEGER,
ADD COLUMN IF NOT EXISTS "brokerageLogoBackground" TEXT;

UPDATE "AgentProfileSettings"
SET "brokerageLogoWidth" = 260
WHERE "brokerageLogoWidth" IS NULL
	OR "brokerageLogoWidth" < 140
	OR "brokerageLogoWidth" > 420;

UPDATE "AgentProfileSettings"
SET "brokerageLogoBackground" = 'CARD'
WHERE "brokerageLogoBackground" IS NULL
	OR "brokerageLogoBackground" NOT IN ('CARD', 'TRANSPARENT');

ALTER TABLE "AgentProfileSettings"
ALTER COLUMN "brokerageLogoWidth" SET DEFAULT 260,
ALTER COLUMN "brokerageLogoWidth" SET NOT NULL,
ALTER COLUMN "brokerageLogoBackground" SET DEFAULT 'CARD',
ALTER COLUMN "brokerageLogoBackground" SET NOT NULL;
