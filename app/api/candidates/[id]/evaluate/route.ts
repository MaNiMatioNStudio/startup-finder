import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateCandidate } from "@/lib/claude";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEYが設定されていません。.envファイルに追加してサーバーを再起動してください。" },
      { status: 400 }
    );
  }

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "候補が見つかりません" }, { status: 404 });

  const evalPrompt = await prisma.evaluationPrompt.findFirst({ where: { isActive: true } });
  if (!evalPrompt) return NextResponse.json({ error: "有効な評価プロンプトがありません" }, { status: 400 });

  const tweets = candidate.sampleTweets ? JSON.parse(candidate.sampleTweets) : [];

  try {
    const result = await evaluateCandidate(evalPrompt.content, {
      username: candidate.xUsername,
      bio: candidate.bio ?? "",
      tweets,
      followersCount: candidate.followersCount ?? 0,
    });

    const evaluation = await prisma.candidateEvaluation.upsert({
      where: { candidateId: id },
      update: {
        entrepreneurScore: result.entrepreneurScore,
        executionScore: result.executionScore,
        marketScore: result.marketScore,
        overallScore: result.overallScore,
        reasoning: result.reasoning,
        keySignals: JSON.stringify(result.keySignals),
        evaluationPromptId: evalPrompt.id,
        evaluatedAt: new Date(),
      },
      create: {
        candidateId: id,
        entrepreneurScore: result.entrepreneurScore,
        executionScore: result.executionScore,
        marketScore: result.marketScore,
        overallScore: result.overallScore,
        reasoning: result.reasoning,
        keySignals: JSON.stringify(result.keySignals),
        evaluationPromptId: evalPrompt.id,
      },
    });

    return NextResponse.json(evaluation);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `評価に失敗しました: ${message}` }, { status: 500 });
  }
}
