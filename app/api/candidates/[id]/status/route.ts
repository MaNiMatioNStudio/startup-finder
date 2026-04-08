import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyQualitativeFeedback, analyzeDevNeed } from "@/lib/claude";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status, reason } = await req.json() as {
    status: "pending" | "scheduled" | "contacted" | "passed" | "hold";
    reason?: string;
  };

  const candidate = await prisma.candidate.update({
    where: { id },
    data: {
      status,
      contactedAt: status === "contacted" ? new Date() : undefined,
      holdReason: status === "hold" ? (reason ?? null) : status === "pending" ? null : undefined,
      // 保留以外にステータスが変わったらアラートをクリア
      holdAlertAt: status !== "hold" ? null : undefined,
      holdAlertText: status !== "hold" ? null : undefined,
    },
  });

  // 理由がある場合、定性フィードバックとしてアルゴリズムを更新
  if (reason?.trim() && (status === "scheduled" || status === "passed" || status === "hold")) {
    const [activePersona, activeExtraction, activeEval] = await Promise.all([
      prisma.personaPrompt.findFirst({ where: { isActive: true } }),
      prisma.extractionPrompt.findFirst({ where: { isActive: true } }),
      prisma.evaluationPrompt.findFirst({ where: { isActive: true } }),
    ]);

    if (activePersona && activeExtraction && activeEval) {
      const signal = status === "scheduled" ? "コンタクト予定（良い候補）" : "見送り（不適切な候補）";
      const feedbackText = `@${candidate.xUsername} を${signal}にしました。理由: ${reason}。${
        status === "scheduled"
          ? "このような候補者がより多く発掘されるようにプロンプトを改善してください。"
          : "このような候補者が除外されるようにプロンプトを改善してください。"
      }`;

      // バックグラウンドで更新（レスポンスは先に返す）
      applyQualitativeFeedback({
        feedback: feedbackText,
        personaPrompt: activePersona.content,
        extractionPrompt: activeExtraction.content,
        evaluationPrompt: activeEval.content,
      }).then(async (result) => {
        const newVersionNum = activePersona.versionNumber + 1;
        const newVersion = `v${newVersionNum}.0`;

        const [newPersona, newExtraction, newEval] = await Promise.all([
          prisma.personaPrompt.create({
            data: {
              version: newVersion,
              versionNumber: newVersionNum,
              content: result.newPersonaContent,
              isActive: true,
              reasoning: result.reasoning,
              predictedScore: result.predictedImprovement,
            },
          }),
          prisma.extractionPrompt.create({
            data: {
              version: newVersion,
              content: result.newExtractionContent,
              isActive: true,
            },
          }),
          prisma.evaluationPrompt.create({
            data: {
              version: newVersion,
              content: result.newEvaluationContent,
              isActive: true,
            },
          }),
        ]);

        await Promise.all([
          prisma.personaPrompt.updateMany({ where: { id: { not: newPersona.id } }, data: { isActive: false } }),
          prisma.extractionPrompt.updateMany({ where: { id: { not: newExtraction.id } }, data: { isActive: false } }),
          prisma.evaluationPrompt.updateMany({ where: { id: { not: newEval.id } }, data: { isActive: false } }),
          prisma.promptEvolution.create({
            data: {
              fromVersionId: activePersona.id,
              toVersionId: newPersona.id,
              systemReasoning: result.reasoning,
              changes: JSON.stringify(result.changes),
              signalsUsed: JSON.stringify([{ type: status, username: candidate.xUsername, reason }]),
              predictedImprovement: result.predictedImprovement,
            },
          }),
        ]);
      }).catch(() => { /* バックグラウンド失敗は無視 */ });
    }

    // 見送りの場合、開発が必要かも分析（バックグラウンド）
    if (status === "passed") {
      analyzeDevNeed({ reason, username: candidate.xUsername })
        .then(async (analysis) => {
          if (analysis.needsDev && analysis.devDescription && analysis.claudeCodePrompt) {
            await prisma.devAlert.create({
              data: {
                triggerReason: reason,
                candidateUsername: candidate.xUsername,
                devDescription: analysis.devDescription,
                claudeCodePrompt: analysis.claudeCodePrompt,
              },
            });
          }
        })
        .catch(() => { /* 無視 */ });
    }
  }

  return NextResponse.json(candidate);
}
