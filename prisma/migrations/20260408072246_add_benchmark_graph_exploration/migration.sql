-- CreateTable
CREATE TABLE "BenchmarkAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "exploredAt" DATETIME,
    "exploredCount" INTEGER NOT NULL DEFAULT 0,
    "nextFollowerToken" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCandidateId" TEXT
);

-- CreateTable
CREATE TABLE "GraphExplorationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'running',
    "benchmarksUsed" TEXT NOT NULL,
    "followersScanned" INTEGER NOT NULL DEFAULT 0,
    "candidatesAdded" INTEGER NOT NULL DEFAULT 0,
    "candidatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "minFollowers" INTEGER NOT NULL DEFAULT 50,
    "maxFollowers" INTEGER NOT NULL DEFAULT 5000,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ExploredAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT,
    "exploredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredVia" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "profileData" TEXT,
    "sampleTweets" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactedAt" DATETIME,
    "companyName" TEXT,
    "fundingRound" TEXT,
    "fundingAmount" TEXT,
    "fundingCheckedAt" DATETIME,
    "holdReason" TEXT,
    "holdAlertAt" DATETIME,
    "holdAlertText" TEXT,
    "holdCheckedAt" DATETIME,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'keyword',
    "graphSources" TEXT,
    "personaPromptId" TEXT NOT NULL,
    "extractionPromptId" TEXT,
    CONSTRAINT "Candidate_personaPromptId_fkey" FOREIGN KEY ("personaPromptId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Candidate_extractionPromptId_fkey" FOREIGN KEY ("extractionPromptId") REFERENCES "ExtractionPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Candidate" ("bio", "companyName", "contactedAt", "discoveredAt", "displayName", "extractionPromptId", "followersCount", "fundingAmount", "fundingCheckedAt", "fundingRound", "holdAlertAt", "holdAlertText", "holdCheckedAt", "holdReason", "id", "lastFetchedAt", "personaPromptId", "profileData", "sampleTweets", "status", "xId", "xUsername") SELECT "bio", "companyName", "contactedAt", "discoveredAt", "displayName", "extractionPromptId", "followersCount", "fundingAmount", "fundingCheckedAt", "fundingRound", "holdAlertAt", "holdAlertText", "holdCheckedAt", "holdReason", "id", "lastFetchedAt", "personaPromptId", "profileData", "sampleTweets", "status", "xId", "xUsername" FROM "Candidate";
DROP TABLE "Candidate";
ALTER TABLE "new_Candidate" RENAME TO "Candidate";
CREATE UNIQUE INDEX "Candidate_xUsername_key" ON "Candidate"("xUsername");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkAccount_xUsername_key" ON "BenchmarkAccount"("xUsername");

-- CreateIndex
CREATE UNIQUE INDEX "ExploredAccount_xUsername_key" ON "ExploredAccount"("xUsername");
