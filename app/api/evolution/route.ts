import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolvePersonaPrompt } from "@/lib/claude";

// GET: Get evolution history
export async function GET() {
  const evolutions = await prisma.promptEvolution.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromVersion: { select: { version: true, actualScore: true } },
      toVersion: { select: { version: true, actualScore: true } },
    },
  });
  return NextResponse.json(evolutions);
}

// POST: Trigger evolution from recent unprocessed feedback
export async function POST(req: NextRequest) {
  const { batchId } = await req.json() as { batchId?: string };

  const activePersona = await prisma.personaPrompt.findFirst({ where: { isActive: true } });
  if (!activePersona) {
    return NextResponse.json({ error: "No active persona" }, { status: 400 });
  }

  // Get recent feedback batches (unprocessed)
  const batches = await prisma.feedbackBatch.findMany({
    where: {
      personaPromptId: activePersona.id,
      processedAt: null,
      ...(batchId ? { id: batchId } : {}),
    },
    include: {
      feedbacks: {
        include: {
          candidate: {
            include: { evaluation: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (batches.length === 0) {
    return NextResponse.json({ error: "No unprocessed feedback found" }, { status: 400 });
  }

  // Aggregate all feedbacks
  const allFeedbacks = batches.flatMap((b) =>
    b.feedbacks.map((f) => ({
      username: f.candidate.xUsername,
      score: f.score,
      comment: f.comment ?? undefined,
      evaluation: f.candidate.evaluation
        ? {
            entrepreneurScore: f.candidate.evaluation.entrepreneurScore,
            executionScore: f.candidate.evaluation.executionScore,
            marketScore: f.candidate.evaluation.marketScore,
          }
        : undefined,
    }))
  );

  const overallComment = batches
    .map((b) => b.overallComment)
    .filter(Boolean)
    .join(" / ") || undefined;

  // Get past evolutions for context
  const pastEvolutions = await prisma.promptEvolution.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      fromVersion: { select: { actualScore: true } },
      toVersion: { select: { actualScore: true } },
    },
  });

  const evolutionHistory = pastEvolutions.map((e) => ({
    changes: JSON.parse(e.changes).map((c: { description: string }) => c.description).join(", "),
    predictedImprovement: e.predictedImprovement,
    actualImprovement:
      e.toVersion.actualScore !== null && e.fromVersion.actualScore !== null
        ? ((e.toVersion.actualScore - e.fromVersion.actualScore) / e.fromVersion.actualScore) * 100
        : null,
  }));

  // Call Claude to evolve
  const result = await evolvePersonaPrompt({
    currentPrompt: activePersona.content,
    feedbacks: allFeedbacks,
    overallComment,
    previousEvolutions: evolutionHistory,
  });

  // Create new persona version
  const nextNumber = activePersona.versionNumber + 1;
  const newVersion = `v${nextNumber}.0`;

  await prisma.personaPrompt.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const newPersona = await prisma.personaPrompt.create({
    data: {
      version: newVersion,
      versionNumber: nextNumber,
      content: result.newPromptContent,
      isActive: true,
      reasoning: result.reasoning.slice(0, 500),
      predictedScore: result.predictedImprovement,
    },
  });

  // Record the evolution
  const evolution = await prisma.promptEvolution.create({
    data: {
      fromVersionId: activePersona.id,
      toVersionId: newPersona.id,
      systemReasoning: result.reasoning,
      changes: JSON.stringify(result.changes),
      signalsUsed: JSON.stringify({
        feedbackCount: allFeedbacks.length,
        avgScore: allFeedbacks.reduce((s, f) => s + f.score, 0) / allFeedbacks.length,
        hasOverallComment: !!overallComment,
      }),
      predictedImprovement: result.predictedImprovement,
    },
  });

  // Mark batches as processed
  await prisma.feedbackBatch.updateMany({
    where: { id: { in: batches.map((b) => b.id) } },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({
    evolution,
    newPersona,
    reasoning: result.reasoning,
    changes: result.changes,
    predictedImprovement: result.predictedImprovement,
  });
}
