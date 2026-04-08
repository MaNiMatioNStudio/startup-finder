import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Submit a batch of scores
export async function POST(req: NextRequest) {
  const { scores, overallComment } = await req.json() as {
    scores: Array<{ candidateId: string; score: number; comment?: string }>;
    overallComment?: string;
  };

  const activePersona = await prisma.personaPrompt.findFirst({ where: { isActive: true } });
  if (!activePersona) {
    return NextResponse.json({ error: "No active persona" }, { status: 400 });
  }

  const avgScore = scores.reduce((s, f) => s + f.score, 0) / scores.length;

  const batch = await prisma.feedbackBatch.create({
    data: {
      overallComment,
      averageScore: avgScore,
      personaPromptId: activePersona.id,
      feedbacks: {
        create: scores.map((s) => ({
          candidateId: s.candidateId,
          score: s.score,
          comment: s.comment,
        })),
      },
    },
    include: { feedbacks: true },
  });

  return NextResponse.json(batch);
}

// Get unscored candidates for current active persona
export async function GET() {
  const activePersona = await prisma.personaPrompt.findFirst({ where: { isActive: true } });
  if (!activePersona) {
    return NextResponse.json([]);
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      personaPromptId: activePersona.id,
      humanFeedbacks: { none: {} },
      evaluation: { isNot: null },
    },
    include: {
      evaluation: true,
    },
    orderBy: { evaluation: { overallScore: "desc" } },
  });

  return NextResponse.json(candidates);
}
