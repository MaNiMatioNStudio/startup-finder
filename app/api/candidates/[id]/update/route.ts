import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { bio, tweets } = await req.json() as { bio?: string; tweets?: string[] };

  const candidate = await prisma.candidate.update({
    where: { id },
    data: {
      ...(bio !== undefined && { bio }),
      ...(tweets !== undefined && { sampleTweets: JSON.stringify(tweets) }),
      lastFetchedAt: new Date(),
    },
  });

  return NextResponse.json(candidate);
}
