-- CreateTable
CREATE TABLE "PersonaPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "predictedScore" REAL,
    "actualScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExtractionPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvaluationPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xUsername" TEXT NOT NULL,
    "xId" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "profileData" TEXT,
    "sampleTweets" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personaPromptId" TEXT NOT NULL,
    "extractionPromptId" TEXT,
    CONSTRAINT "Candidate_personaPromptId_fkey" FOREIGN KEY ("personaPromptId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Candidate_extractionPromptId_fkey" FOREIGN KEY ("extractionPromptId") REFERENCES "ExtractionPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entrepreneurScore" REAL NOT NULL,
    "executionScore" REAL NOT NULL,
    "marketScore" REAL NOT NULL,
    "overallScore" REAL NOT NULL,
    "reasoning" TEXT NOT NULL,
    "keySignals" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "evaluationPromptId" TEXT NOT NULL,
    CONSTRAINT "CandidateEvaluation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CandidateEvaluation_evaluationPromptId_fkey" FOREIGN KEY ("evaluationPromptId") REFERENCES "EvaluationPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HumanFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "batchId" TEXT,
    CONSTRAINT "HumanFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HumanFeedback_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeedbackBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overallComment" TEXT,
    "averageScore" REAL,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personaPromptId" TEXT NOT NULL,
    CONSTRAINT "FeedbackBatch_personaPromptId_fkey" FOREIGN KEY ("personaPromptId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptEvolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemReasoning" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "signalsUsed" TEXT NOT NULL,
    "predictedImprovement" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromVersionId" TEXT NOT NULL,
    "toVersionId" TEXT NOT NULL,
    CONSTRAINT "PromptEvolution_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromptEvolution_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "PersonaPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XFetchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultCount" INTEGER NOT NULL,
    "nextToken" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonaPrompt_version_key" ON "PersonaPrompt"("version");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionPrompt_version_key" ON "ExtractionPrompt"("version");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPrompt_version_key" ON "EvaluationPrompt"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_xUsername_key" ON "Candidate"("xUsername");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEvaluation_candidateId_key" ON "CandidateEvaluation"("candidateId");
