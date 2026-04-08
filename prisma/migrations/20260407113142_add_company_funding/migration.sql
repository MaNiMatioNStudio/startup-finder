-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "fundingAmount" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "fundingCheckedAt" DATETIME;
ALTER TABLE "Candidate" ADD COLUMN "fundingRound" TEXT;
