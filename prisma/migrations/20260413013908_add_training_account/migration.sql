-- CreateTable
CREATE TABLE "TrainingAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scopes" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAccount_xUsername_key" ON "TrainingAccount"("xUsername");
