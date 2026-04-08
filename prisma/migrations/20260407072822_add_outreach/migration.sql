-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedText" TEXT NOT NULL,
    "editedText" TEXT,
    "sources" TEXT NOT NULL,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "OutreachMessage_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personaPromptId" TEXT NOT NULL,
    "extractionPromptId" TEXT,
    CONSTRAINT "Candidate_personaPromptId_fkey" FOREIGN KEY ("personaPromptId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Candidate_extractionPromptId_fkey" FOREIGN KEY ("extractionPromptId") REFERENCES "ExtractionPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Candidate" ("bio", "discoveredAt", "displayName", "extractionPromptId", "followersCount", "id", "lastFetchedAt", "personaPromptId", "profileData", "sampleTweets", "xId", "xUsername") SELECT "bio", "discoveredAt", "displayName", "extractionPromptId", "followersCount", "id", "lastFetchedAt", "personaPromptId", "profileData", "sampleTweets", "xId", "xUsername" FROM "Candidate";
DROP TABLE "Candidate";
ALTER TABLE "new_Candidate" RENAME TO "Candidate";
CREATE UNIQUE INDEX "Candidate_xUsername_key" ON "Candidate"("xUsername");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_version_key" ON "MessageTemplate"("version");
