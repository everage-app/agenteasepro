-- Add missing Task enums and columns

DO $$ BEGIN
  CREATE TYPE "TaskCategory" AS ENUM ('GENERAL', 'CONTRACT', 'MARKETING', 'CALL', 'NOTE', 'POPBY', 'EVENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskBucket" AS ENUM ('TODAY', 'THIS_WEEK', 'LATER', 'DONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "category" "TaskCategory" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "bucket" "TaskBucket" NOT NULL DEFAULT 'TODAY',
  ADD COLUMN IF NOT EXISTS "listingId" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingBlastId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_marketingBlastId_fkey" FOREIGN KEY ("marketingBlastId") REFERENCES "MarketingBlast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
