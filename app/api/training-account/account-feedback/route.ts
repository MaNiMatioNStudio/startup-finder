import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface FeedbackItem {
  xUsername: string;
  displayName?: string | null;
  bio?: string | null;
  score: number;
  reason?: string;
  xId?: string;
}

export async function POST(req: NextRequest) {
  const { feedbacks }: { feedbacks: FeedbackItem[] } = await req.json();

  const results: { username: string; action: string }[] = [];

  for (const f of feedbacks) {
    const action = f.score >= 6 ? "added" : "rejected";

    // フィードバックを記録
    await prisma.accountFeedback.create({
      data: {
        xUsername: f.xUsername,
        displayName: f.displayName ?? null,
        bio: f.bio ?? null,
        score: f.score,
        reason: f.reason ?? null,
        action,
      },
    });

    // スコア6以上なら参考アカウントに追加
    if (action === "added") {
      const existing = await prisma.referenceAccount.findUnique({ where: { xUsername: f.xUsername } });
      if (!existing) {
        await prisma.referenceAccount.create({
          data: {
            xUsername: f.xUsername,
            xId: f.xId ?? null,
            displayName: f.displayName ?? null,
            bio: f.bio ?? null,
            reason: `AIが提案・スコア${f.score}点で追加`,
          },
        });
      }
    }

    results.push({ username: f.xUsername, action });
  }

  const added = results.filter(r => r.action === "added").length;
  const rejected = results.filter(r => r.action === "rejected").length;
  return NextResponse.json({ ok: true, added, rejected });
}
