-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskBucket" AS ENUM ('TODAY', 'THIS_WEEK', 'LATER', 'DONE');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "bucket" "TaskBucket" NOT NULL DEFAULT 'TODAY',
ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "marketingBlastId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL';

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_marketingBlastId_fkey" FOREIGN KEY ("marketingBlastId") REFERENCES "MarketingBlast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
