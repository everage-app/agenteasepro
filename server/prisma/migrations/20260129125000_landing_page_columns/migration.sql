-- Add missing LandingPage JSON columns

ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "customContent" JSONB,
  ADD COLUMN IF NOT EXISTS "customStyles" JSONB;
