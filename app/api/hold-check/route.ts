import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkHoldCondition } from "@/lib/claude";
import { getUserTweets } from "@/lib/x-api";

// GET: 保留中のアラート一覧と保留候補者数を返す
export async function GET() {
  const [alerts, holdCount] = await Promise.all([
    prisma.candidate.findMany({
      where: { status: "hold", holdAlertAt: { not: null } },
      select: {
        id: true,
        xUsername: true,
        displayName: true,
        holdReason: true,
        holdAlertAt: true,
        holdAlertText: true,
      },
      orderBy: { holdAlertAt: "desc" },
    }),
    prisma.candidate.count({ where: { status: "hold" } }),
  ]);

  return NextResponse.json({ alerts, holdCount });
}

// POST: 保留候補者の情報を更新して条件チェック
export async function POST() {
  const holdCandidates = await prisma.candidate.findMany({
    where: { status: "hold", holdReason: { not: null } },
    select: { id: true, xUsername: true, xId: true, bio: true, holdReason: true },
  });

  if (holdCandidates.length === 0) {
    return NextResponse.json({ message: "保留中の候補者はいません", checked: 0, alerts: 0 });
  }

  let alertsTriggered = 0;
  const results: Array<{ username: string; conditionMet: boolean; alertText: string | null }> = [];

  for (let i = 0; i < holdCandidates.length; i++) {
    const candidate = holdCandidates[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));

    try {
      // 最新ツイートを取得
      let latestTweets: string[] = [];
      if (candidate.xId && process.env.X_BEARER_TOKEN) {
        const rawTweets = await getUserTweets(candidate.xId, 10);
        latestTweets = rawTweets.map((t) => t.text);
        // ツイートをDBに保存
        if (latestTweets.length > 0) {
          await prisma.candidate.update({
            where: { id: candidate.id },
            data: { sampleTweets: JSON.stringify(latestTweets), lastFetchedAt: new Date() },
          });
        }
      }

      // 保留条件チェック
      const result = await checkHoldCondition({
        username: candidate.xUsername,
        holdReason: candidate.holdReason!,
        latestTweets,
        bio: candidate.bio,
      });

      await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          holdCheckedAt: new Date(),
          holdAlertAt: result.conditionMet ? new Date() : undefined,
          holdAlertText: result.conditionMet ? result.alertText : undefined,
        },
      });

      if (result.conditionMet) alertsTriggered++;
      results.push({ username: candidate.xUsername, ...result });
    } catch {
      results.push({ username: candidate.xUsername, conditionMet: false, alertText: null });
    }
  }

  return NextResponse.json({
    checked: holdCandidates.length,
    alerts: alertsTriggered,
    results,
  });
}
