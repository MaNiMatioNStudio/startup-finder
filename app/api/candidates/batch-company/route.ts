import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCompanyAndFunding } from "@/lib/claude";

// GET: return search engine config status
export async function GET() {
  return NextResponse.json({
    braveEnabled: !!process.env.BRAVE_SEARCH_API_KEY,
    searchEngine: process.env.BRAVE_SEARCH_API_KEY ? "Brave Search API" : "DuckDuckGo (fallback)",
  });
}

// POST: run company/funding research on all candidates that haven't been checked yet
export async function POST() {
  const candidates = await prisma.candidate.findMany({
    where: { fundingCheckedAt: null },
    select: { id: true, xUsername: true, bio: true, sampleTweets: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ message: "調査対象の候補がありません", updated: 0 });
  }

  const results: Array<{ id: string; username: string; companyName: string | null; fundingRound: string | null; error?: string }> = [];

  // Brave API: minimal wait (reliable). DDG fallback: longer wait to avoid bot detection.
  const interDelay = process.env.BRAVE_SEARCH_API_KEY ? 1000 : 15000;

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    if (idx > 0) await new Promise((r) => setTimeout(r, interDelay));
    try {
      const tweets: string[] = candidate.sampleTweets ? JSON.parse(candidate.sampleTweets) : [];

      const result = await extractCompanyAndFunding({
        username: candidate.xUsername,
        bio: candidate.bio,
        tweets,
      });

      await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          companyName: result.companyName,
          fundingRound: result.fundingRound,
          fundingAmount: result.fundingAmount,
          fundingCheckedAt: new Date(),
        },
      });

      results.push({
        id: candidate.id,
        username: candidate.xUsername,
        companyName: result.companyName,
        fundingRound: result.fundingRound,
      });
    } catch (e) {
      results.push({
        id: candidate.id,
        username: candidate.xUsername,
        companyName: null,
        fundingRound: null,
        error: String(e),
      });
    }
  }

  return NextResponse.json({ updated: results.length, results });
}
