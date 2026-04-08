import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCompanyAndFunding } from "@/lib/claude";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tweets: string[] = candidate.sampleTweets ? JSON.parse(candidate.sampleTweets) : [];

  const result = await extractCompanyAndFunding({
    username: candidate.xUsername,
    bio: candidate.bio,
    tweets,
  });

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      companyName: result.companyName,
      fundingRound: result.fundingRound,
      fundingAmount: result.fundingAmount,
      fundingCheckedAt: new Date(),
    },
  });

  return NextResponse.json({ ...updated, reasoning: result.reasoning });
}
