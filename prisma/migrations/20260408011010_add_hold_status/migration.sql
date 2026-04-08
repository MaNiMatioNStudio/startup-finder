-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "holdAlertAt" DATETIME;
ALTER TABLE "Candidate" ADD COLUMN "holdAlertText" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "holdCheckedAt" DATETIME;
ALTER TABLE "Candidate" ADD COLUMN "holdReason" TEXT;
