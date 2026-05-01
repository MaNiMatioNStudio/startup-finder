/*
  Warnings:

  - You are about to drop the column `maxFollowers` on the `GraphExplorationRun` table. All the data in the column will be lost.
  - You are about to drop the column `minFollowers` on the `GraphExplorationRun` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "GraphExplorationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minFollowers" INTEGER NOT NULL DEFAULT 50,
    "maxFollowers" INTEGER NOT NULL DEFAULT 5000,
    "bioIncludeKeywords" TEXT NOT NULL DEFAULT '[]',
    "bioExcludeKeywords" TEXT NOT NULL DEFAULT '[]',
    "minTweetCount" INTEGER NOT NULL DEFAULT 0,
    "maxFollowingRatio" REAL NOT NULL DEFAULT 0,
    "evolutionReasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GraphExplorationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'running',
    "benchmarksUsed" TEXT NOT NULL,
    "followersScanned" INTEGER NOT NULL DEFAULT 0,
    "candidatesAdded" INTEGER NOT NULL DEFAULT 0,
    "candidatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "settingsVersion" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
INSERT INTO "new_GraphExplorationRun" ("benchmarksUsed", "candidatesAdded", "candidatesSkipped", "completedAt", "errors", "followersScanned", "id", "startedAt", "status") SELECT "benchmarksUsed", "candidatesAdded", "candidatesSkipped", "completedAt", "errors", "followersScanned", "id", "startedAt", "status" FROM "GraphExplorationRun";
DROP TABLE "GraphExplorationRun";
ALTER TABLE "new_GraphExplorationRun" RENAME TO "GraphExplorationRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
