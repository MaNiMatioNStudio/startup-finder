// Manually add a candidate by X username
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserByUsername, getUserTweets } from "@/lib/x-api";
import { evaluateCandidate } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { xUsername } = await req.json() as { xUsername: string };

  if (!xUsername?.trim()) {
    return NextResponse.json({ error: "ユーザー名を入力してください" }, { status: 400 });
  }

  const cleanUsername = xUsername.trim().replace(/^@/, "");

  const activePersona = await prisma.personaPrompt.findFirst({ where: { isActive: true } });
  const activeExtraction = await prisma.extractionPrompt.findFirst({ where: { isActive: true } });
  const activeEval = await prisma.evaluationPrompt.findFirst({ where: { isActive: true } });

  if (!activePersona) {
    return NextResponse.json({ error: "有効なPersona Promptがありません。先にシードデータを作成してください。" }, { status: 400 });
  }

  // Fetch from X API (optional — gracefully skip if not configured)
  let user = null;
  let tweets: string[] = [];

  if (process.env.X_BEARER_TOKEN) {
    try {
      user = await getUserByUsername(cleanUsername);
      if (user) {
        const rawTweets = await getUserTweets(user.id, 15);
        tweets = rawTweets.map((t) => t.text);
      }
    } catch {
      // X API unavailable — continue with username only
    }
  }

  // Upsert candidate (existing candidate gets updated profile data)
  const candidate = await prisma.candidate.upsert({
    where: { xUsername: cleanUsername },
    update: {
      ...(user?.name && { displayName: user.name }),
      ...(user?.id && { xId: user.id }),
      ...(user?.description && { bio: user.description }),
      ...(user?.public_metrics?.followers_count !== undefined && {
        followersCount: user.public_metrics.followers_count,
      }),
      ...(tweets.length > 0 && { sampleTweets: JSON.stringify(tweets) }),
      lastFetchedAt: new Date(),
    },
    create: {
      xUsername: cleanUsername,
      displayName: user?.name ?? null,
      xId: user?.id ?? null,
      bio: user?.description ?? null,
      followersCount: user?.public_metrics?.followers_count ?? null,
      sampleTweets: JSON.stringify(tweets),
      personaPromptId: activePersona.id,
      extractionPromptId: activeExtraction?.id ?? null,
    },
  });

  // Auto-evaluate with Claude if API key is set and we have some data
  if (process.env.ANTHROPIC_API_KEY && activeEval && (tweets.length > 0 || user?.description)) {
    try {
      const result = await evaluateCandidate(activeEval.content, {
        username: cleanUsername,
        bio: user?.description ?? "",
        tweets,
        followersCount: user?.public_metrics?.followers_count ?? 0,
      });

      await prisma.candidateEvaluation.upsert({
        where: { candidateId: candidate.id },
        update: {
          entrepreneurScore: result.entrepreneurScore,
          executionScore: result.executionScore,
          marketScore: result.marketScore,
          overallScore: result.overallScore,
          reasoning: result.reasoning,
          keySignals: JSON.stringify(result.keySignals),
          evaluationPromptId: activeEval.id,
          evaluatedAt: new Date(),
        },
        create: {
          candidateId: candidate.id,
          entrepreneurScore: result.entrepreneurScore,
          executionScore: result.executionScore,
          marketScore: result.marketScore,
          overallScore: result.overallScore,
          reasoning: result.reasoning,
          keySignals: JSON.stringify(result.keySignals),
          evaluationPromptId: activeEval.id,
        },
      });
    } catch {
      // Evaluation failed — candidate is still saved, can evaluate manually later
    }
  }

  const full = await prisma.candidate.findUnique({
    where: { id: candidate.id },
    include: {
      evaluation: true,
      personaPrompt: { select: { version: true } },
      humanFeedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json(full);
}
