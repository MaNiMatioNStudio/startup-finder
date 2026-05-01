-- CreateTable
CREATE TABLE "ReferenceAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "reason" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrainingAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "targetUsername" TEXT,
    "tweetId" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'done'
);

-- CreateTable
CREATE TABLE "TimelinePost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tweetId" TEXT NOT NULL,
    "authorUsername" TEXT,
    "content" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "feedback" TEXT,
    "scoredAt" DATETIME
);

-- CreateTable
CREATE TABLE "TrainingStrategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceAccount_xUsername_key" ON "ReferenceAccount"("xUsername");

-- CreateIndex
CREATE UNIQUE INDEX "TimelinePost_tweetId_key" ON "TimelinePost"("tweetId");
