-- CreateTable
CREATE TABLE "DevAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggerReason" TEXT NOT NULL,
    "candidateUsername" TEXT NOT NULL,
    "devDescription" TEXT NOT NULL,
    "claudeCodePrompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
