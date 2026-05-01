import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserByUsername } from "@/lib/x-api";
import { getValidToken } from "@/lib/x-auth";
import { callClaude } from "@/lib/claude";

const X_API_BASE = "https://api.twitter.com/2";

async function xAuthedGet(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${X_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function xAuthedPost(path: string, body: unknown, token: string) {
  const res = await fetch(`${X_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ストラテジーに基づいて各アカウントへのいいね数(0-5)を決定
async function getStrategyWeights(
  strategyContent: string,
  references: { xUsername: string; bio: string | null; reason: string | null }[]
): Promise<Record<string, number>> {
  const prompt = `あなたはXアルゴリズム教育の専門家です。

## 現在のストラテジー
${strategyContent}

## 参考アカウント一覧
${references.map(r => `- @${r.xUsername}: bio="${r.bio ?? "不明"}" 追加理由="${r.reason ?? "未記入"}"`).join("\n")}

## タスク
上記ストラテジーに基づき、各アカウントへのいいね数（0〜5の整数）を決定してください。
- ストラテジーの方向性に強く合致するアカウント: 4〜5
- ある程度合致する: 2〜3
- あまり合致しない: 0〜1

## 出力
JSON配列のみを返してください（説明文不要）:
[{"username":"アカウント名","likes":数値,"reason":"一言理由"}]`;

  try {
    const result = await callClaude(prompt);
    const match = result.match(/\[[\s\S]*\]/);
    if (!match) return {};
    const parsed: { username: string; likes: number; reason?: string }[] = JSON.parse(match[0]);
    return Object.fromEntries(
      parsed.map(w => [w.username, Math.min(5, Math.max(0, Math.round(w.likes)))])
    );
  } catch {
    return {};
  }
}

export async function POST() {
  const { token, error: tokenError } = await getValidToken();
  if (!token) return NextResponse.json({ error: tokenError }, { status: 401 });

  const trainingAccount = await prisma.trainingAccount.findFirst({ where: { isActive: true } });
  if (!trainingAccount) return NextResponse.json({ error: "連携アカウントがありません" }, { status: 400 });

  const references = await prisma.referenceAccount.findMany();
  if (references.length === 0) return NextResponse.json({ error: "参考アカウントがありません" }, { status: 400 });

  // アクティブなストラテジーがあれば重み付けを取得
  const strategy = await prisma.trainingStrategy.findFirst({
    where: { isActive: true },
    orderBy: { generation: "desc" },
  });

  let weights: Record<string, number> = {};
  let strategyApplied = false;
  if (strategy) {
    weights = await getStrategyWeights(strategy.content, references);
    strategyApplied = Object.keys(weights).length > 0;
  }

  const getLikeCount = (username: string) => weights[username] ?? 3; // デフォルト3件

  const myXId: string = trainingAccount.xId;
  const actions: { type: string; targetUsername: string; tweetId?: string; status: string; weight?: number }[] = [];
  const errors: string[] = [];

  for (const ref of references) {
    let refXId: string | null = ref.xId;
    if (!refXId) {
      const user = await getUserByUsername(ref.xUsername);
      if (!user) continue;
      refXId = user.id;
      await prisma.referenceAccount.update({
        where: { id: ref.id },
        data: { xId: user.id, displayName: user.name, bio: user.description ?? null },
      });
    }
    if (!refXId) continue;

    const likeCount = getLikeCount(ref.xUsername);

    // フォロー
    const followRes = await xAuthedPost(`/users/${myXId}/following`, { target_user_id: refXId }, token);
    actions.push({ type: "follow", targetUsername: ref.xUsername, status: followRes.ok ? "done" : "failed" });
    if (!followRes.ok) errors.push(`follow @${ref.xUsername}: ${JSON.stringify(followRes.data)}`);

    // いいね（ストラテジーで決まった件数、0なら実行しない）
    if (likeCount > 0) {
      const tweetsData = await xAuthedGet(`/users/${refXId}/tweets`, token, {
        max_results: String(Math.max(5, likeCount)),
        "tweet.fields": "created_at",
        exclude: "retweets,replies",
      });

      const tweets: { id: string }[] = tweetsData?.data ?? [];
      for (const tweet of tweets.slice(0, likeCount)) {
        const likeRes = await xAuthedPost(`/users/${myXId}/likes`, { tweet_id: tweet.id }, token);
        actions.push({
          type: "like",
          targetUsername: ref.xUsername,
          tweetId: tweet.id,
          status: likeRes.ok ? "done" : "failed",
          weight: likeCount,
        });
        if (!likeRes.ok) errors.push(`like @${ref.xUsername}: ${JSON.stringify(likeRes.data)}`);
      }
    }
  }

  if (actions.length > 0) {
    await prisma.trainingAction.createMany({
      data: actions.map(a => ({
        type: a.type,
        targetUsername: a.targetUsername,
        tweetId: a.tweetId ?? null,
        status: a.status,
      })),
    });
  }

  const done = actions.filter(a => a.status === "done").length;
  const failed = actions.filter(a => a.status === "failed").length;
  return NextResponse.json({
    ok: true,
    done,
    failed,
    strategyApplied,
    strategyGeneration: strategy?.generation ?? null,
    weights,
    errors: errors.length > 0 ? errors : undefined,
  });
}
