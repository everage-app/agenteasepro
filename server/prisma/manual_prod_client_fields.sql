DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientTemperature') THEN
    CREATE TYPE "ClientTemperature" AS ENUM ('HOT', 'WARM', 'COLD');
  END IF;
END
$$;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "mailingAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "mailingCity" TEXT,
  ADD COLUMN IF NOT EXISTS "mailingState" TEXT,
  ADD COLUMN IF NOT EXISTS "mailingZip" TEXT,
  ADD COLUMN IF NOT EXISTS "temperature" "ClientTemperature" NOT NULL DEFAULT 'COLD';
