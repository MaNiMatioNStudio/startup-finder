-- CreateTable
CREATE TABLE "CollectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'running',
    "queriesUsed" TEXT NOT NULL,
    "tweetsFound" INTEGER NOT NULL DEFAULT 0,
    "candidatesAdded" INTEGER NOT NULL DEFAULT 0,
    "candidatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
