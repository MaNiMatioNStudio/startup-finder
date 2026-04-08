import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchRecentTweets, getUserByUsername, getUserTweets } from "@/lib/x-api";
import { extractCandidatesFromText } from "@/lib/claude";

// X API fetch + candidate extraction pipeline
export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query?: string };

  const activePersona = await prisma.personaPrompt.findFirst({ where: { isActive: true } });
  const activeExtraction = await prisma.extractionPrompt.findFirst({ where: { isActive: true } });

  if (!activePersona || !activeExtraction) {
    return NextResponse.json({ error: "Missing active prompts" }, { status: 400 });
  }

  // Get last fetch token for differential fetching (差分取得)
  const lastFetch = await prisma.xFetchLog.findFirst({
    where: { query: query ?? "default" },
    orderBy: { fetchedAt: "desc" },
  });

  const searchQuery = query ?? "MRR OR SaaS OR プロダクト OR 起業 lang:ja -is:retweet";

  let allTweets: Array<{ text: string; authorUsername?: string }> = [];
  let nextToken: string | undefined;

  try {
    const result = await searchRecentTweets(searchQuery, lastFetch?.nextToken ?? undefined);

    // Build a map of userId -> username from expanded users
    const userMap = new Map<string, string>(
      (result.userObjects ?? []).map((u) => [u.id, u.username])
    );

    allTweets = result.tweets.map((t) => ({
      text: t.text,
      authorUsername: t.authorId ? userMap.get(t.authorId) : undefined,
    }));

    nextToken = result.nextToken;

    await prisma.xFetchLog.create({
      data: {
        query: query ?? "default",
        resultCount: result.tweets.length,
        nextToken: nextToken ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: `X API error: ${err}` }, { status: 502 });
  }

  if (allTweets.length === 0) {
    return NextResponse.json({ message: "No new tweets", candidates: [] });
  }

  // Use Claude to extract candidate usernames from tweet texts
  const postsText = allTweets.map((t) => `@${t.authorUsername ?? "unknown"}: ${t.text}`).join("\n\n");
  let candidateUsernames: string[] = [];
  try {
    candidateUsernames = await extractCandidatesFromText(
      activeExtraction.content,
      activePersona.content,
      postsText
    );
  } catch {
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }

  // Also include authors whose tweets scored well (already surfaced by Claude)
  const authorUsernames = allTweets
    .map((t) => t.authorUsername)
    .filter((u): u is string => !!u);
  const allCandidateUsernames = [...new Set([...candidateUsernames, ...authorUsernames.slice(0, 3)])];

  // For each candidate, fetch full profile + recent tweets (max 5 per run to stay within rate limits)
  const newCandidates = [];
  for (const username of allCandidateUsernames.slice(0, 5)) {
    const existing = await prisma.candidate.findUnique({ where: { xUsername: username } });
    if (existing) continue;

    try {
      const user = await getUserByUsername(username);
      const tweets = user ? await getUserTweets(user.id, 15) : [];

      const candidate = await prisma.candidate.create({
        data: {
          xUsername: username,
          xId: user?.id,
          displayName: user?.name,
          bio: user?.description,
          followersCount: user?.public_metrics?.followers_count,
          personaPromptId: activePersona.id,
          extractionPromptId: activeExtraction.id,
          sampleTweets: JSON.stringify(
            tweets.length > 0
              ? tweets.map((t) => t.text)
              : allTweets.filter((t) => t.authorUsername === username).map((t) => t.text)
          ),
        },
      });
      newCandidates.push(candidate);
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    message: `Found ${newCandidates.length} new candidates`,
    candidates: newCandidates,
    totalTweets: allTweets.length,
    extractedUsernames: candidateUsernames,
  });
}
