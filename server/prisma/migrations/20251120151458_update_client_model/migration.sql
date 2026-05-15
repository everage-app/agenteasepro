/*
  Warnings:

  - The values [NEW,LOST] on the enum `ClientStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "ClientRole" ADD VALUE 'OTHER';

-- AlterEnum
BEGIN;
CREATE TYPE "ClientStage_new" AS ENUM ('NEW_LEAD', 'NURTURE', 'ACTIVE', 'UNDER_CONTRACT', 'CLOSED', 'PAST_CLIENT', 'DEAD');
ALTER TABLE "Client" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "stage" TYPE "ClientStage_new" USING ("stage"::text::"ClientStage_new");
ALTER TYPE "ClientStage" RENAME TO "ClientStage_old";
ALTER TYPE "ClientStage_new" RENAME TO "ClientStage";
DROP TYPE "ClientStage_old";
ALTER TABLE "Client" ALTER COLUMN "stage" SET DEFAULT 'NEW_LEAD';
COMMIT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lastContactAt" TIMESTAMP(3),
ADD COLUMN     "lastMarketingAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "role" SET DEFAULT 'BUYER',
ALTER COLUMN "stage" SET DEFAULT 'NEW_LEAD';
