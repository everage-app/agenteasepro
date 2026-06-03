CREATE TABLE IF NOT EXISTS "SmartList" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "filters" JSONB NOT NULL,
    "sortOrder" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmartList_agentId_name_idx" ON "SmartList"("agentId", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SmartList_agentId_fkey'
  ) THEN
    ALTER TABLE "SmartList"
      ADD CONSTRAINT "SmartList_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
