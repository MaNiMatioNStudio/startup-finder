import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("personaId");
  const scored = searchParams.get("scored");

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(personaId ? { personaPromptId: personaId } : {}),
      ...(scored === "false"
        ? { humanFeedbacks: { none: {} } }
        : scored === "true"
        ? { humanFeedbacks: { some: {} } }
        : {}),
    },
    include: {
      evaluation: true,
      humanFeedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
      personaPrompt: { select: { version: true } },
    },
    orderBy: [
      { evaluation: { overallScore: "desc" } },
      { discoveredAt: "desc" },
    ],
  });

  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { xUsername, displayName, bio, followersCount, sampleTweets, personaPromptId, extractionPromptId } = body;

  const activeEvalPrompt = await prisma.evaluationPrompt.findFirst({
    where: { isActive: true },
  });
  if (!activeEvalPrompt) {
    return NextResponse.json({ error: "No active evaluation prompt" }, { status: 400 });
  }

  const candidate = await prisma.candidate.upsert({
    where: { xUsername },
    update: {
      displayName,
      bio,
      followersCount,
      sampleTweets: JSON.stringify(sampleTweets),
      lastFetchedAt: new Date(),
    },
    create: {
      xUsername,
      displayName,
      bio,
      followersCount,
      sampleTweets: JSON.stringify(sampleTweets),
      personaPromptId,
      extractionPromptId,
    },
  });

  return NextResponse.json(candidate);
}
