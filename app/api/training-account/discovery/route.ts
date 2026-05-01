import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 現在の探索状態と未評価候補を返す
export async function GET() {
  const states = await prisma.discoveryState.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const pendingCandidates = await prisma.discoveryCandidate.findMany({
    where: { userAction: null },
    orderBy: [{ aiScore: "desc" }, { createdAt: "desc" }],
  });

  const followedCount = await prisma.discoveryCandidate.count({
    where: { userAction: "follow" },
  });
  const skippedCount = await prisma.discoveryCandidate.count({
    where: { userAction: "skip" },
  });
  const executedCount = await prisma.discoveryCandidate.count({
    where: { userAction: "follow", executedAt: { not: null } },
  });
  const pendingFollowCount = await prisma.discoveryCandidate.count({
    where: { userAction: "follow", executedAt: null },
  });

  return NextResponse.json({
    states,
    pendingCandidates,
    stats: { followedCount, skippedCount, executedCount, pendingFollowCount },
  });
}
