import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyQualitativeFeedback } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { feedback } = await req.json() as { feedback: string };

  if (!feedback?.trim()) {
    return NextResponse.json({ error: "フィードバックを入力してください" }, { status: 400 });
  }

  const [activePersona, activeExtraction, activeEvaluation] = await Promise.all([
    prisma.personaPrompt.findFirst({ where: { isActive: true } }),
    prisma.extractionPrompt.findFirst({ where: { isActive: true } }),
    prisma.evaluationPrompt.findFirst({ where: { isActive: true } }),
  ]);

  if (!activePersona || !activeExtraction || !activeEvaluation) {
    return NextResponse.json({ error: "アクティブなプロンプトが見つかりません" }, { status: 400 });
  }

  const result = await applyQualitativeFeedback({
    feedback,
    personaPrompt: activePersona.content,
    extractionPrompt: activeExtraction.content,
    evaluationPrompt: activeEvaluation.content,
  });

  // Create new versions of all three prompts
  const nextPersonaNum = activePersona.versionNumber + 1;

  const [newPersona, newExtraction, newEvaluation] = await prisma.$transaction(async (tx) => {
    await tx.personaPrompt.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.extractionPrompt.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.evaluationPrompt.updateMany({ where: { isActive: true }, data: { isActive: false } });

    const persona = await tx.personaPrompt.create({
      data: {
        version: `v${nextPersonaNum}.0`,
        versionNumber: nextPersonaNum,
        content: result.newPersonaContent,
        isActive: true,
        reasoning: result.reasoning.slice(0, 500),
        predictedScore: result.predictedImprovement,
      },
    });

    const extraction = await tx.extractionPrompt.create({
      data: {
        version: `v${nextPersonaNum}.0`,
        content: result.newExtractionContent,
        isActive: true,
      },
    });

    const evaluation = await tx.evaluationPrompt.create({
      data: {
        version: `v${nextPersonaNum}.0`,
        content: result.newEvaluationContent,
        isActive: true,
      },
    });

    return [persona, extraction, evaluation];
  });

  // Record evolution
  const evolution = await prisma.promptEvolution.create({
    data: {
      fromVersionId: activePersona.id,
      toVersionId: newPersona.id,
      systemReasoning: result.reasoning,
      changes: JSON.stringify(result.changes),
      signalsUsed: JSON.stringify({
        feedbackCount: 0,
        avgScore: 0,
        hasOverallComment: false,
        qualitativeFeedback: feedback.slice(0, 200),
      }),
      predictedImprovement: result.predictedImprovement,
    },
  });

  return NextResponse.json({
    evolution,
    newPersona,
    newExtraction,
    newEvaluation,
    reasoning: result.reasoning,
    changes: result.changes,
    predictedImprovement: result.predictedImprovement,
  });
}
