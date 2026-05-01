import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/lib/x-auth";

const X_API_BASE = "https://api.twitter.com/2";

async function xAuthedPost(path: string, body: unknown, token: string) {
  const res = await fetch(`${X_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status };
}

export async function POST() {
  const { token, error: tokenError } = await getValidToken();
  if (!token) return NextResponse.json({ error: tokenError }, { status: 401 });

  const trainingAccount = await prisma.trainingAccount.findFirst({ where: { isActive: true } });
  if (!trainingAccount) return NextResponse.json({ error: "連携アカウントがありません" }, { status: 400 });

  // フォロー待ちの候補を取得
  const toFollow = await prisma.discoveryCandidate.findMany({
    where: { userAction: "follow", executedAt: null },
    orderBy: { aiScore: "desc" },
  });

  if (toFollow.length === 0) return NextResponse.json({ done: 0, failed: 0, message: "フォロー待ちの候補がありません" });

  const myXId = trainingAccount.xId;
  let done = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const candidate of toFollow) {
    const res = await xAuthedPost(`/users/${myXId}/following`, { target_user_id: candidate.xId }, token);

    await prisma.discoveryCandidate.update({
      where: { id: candidate.id },
      data: { executedAt: res.ok ? new Date() : null },
    });

    // アクションログに記録
    await prisma.trainingAction.create({
      data: {
        type: "follow",
        targetUsername: candidate.xUsername,
        status: res.ok ? "done" : "failed",
      },
    });

    if (res.ok) {
      done++;
    } else {
      failed++;
      errors.push(`@${candidate.xUsername}: HTTP ${res.status}`);
    }
  }

  return NextResponse.json({ ok: true, done, failed, errors: errors.length > 0 ? errors : undefined });
}
