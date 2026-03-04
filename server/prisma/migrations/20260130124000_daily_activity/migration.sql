-- Create DailyActivity table

CREATE TABLE IF NOT EXISTS "DailyActivity" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "callsGoal" INTEGER NOT NULL DEFAULT 5,
  "callsMade" INTEGER NOT NULL DEFAULT 0,
  "notesGoal" INTEGER NOT NULL DEFAULT 2,
  "notesSent" INTEGER NOT NULL DEFAULT 0,
  "popbysGoal" INTEGER NOT NULL DEFAULT 1,
  "popbysDone" INTEGER NOT NULL DEFAULT 0,
  "referralsAskedGoal" INTEGER NOT NULL DEFAULT 3,
  "referralsAsked" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyActivity_agentId_date_key" ON "DailyActivity" ("agentId", "date");
