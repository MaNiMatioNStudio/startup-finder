import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/claude";
import { getUserByUsername, getUserFollowers } from "@/lib/x-api";

type UserForFilter = {
  id: string;
  username: string;
  name: string;
  description?: string;
  public_metrics?: { followers_count: number; following_count: number; tweet_count: number };
};

// 1バッチあたりのClaude評価件数
const CLAUDE_BATCH_SIZE = 50;

// Claude一次選別: バッチ処理で安全に評価
async function aiFilterCandidates(
  users: UserForFilter[],
  sourceUsername: string
): Promise<{ username: string; score: number; reason: string }[]> {
  const results: { username: string; score: number; reason: string }[] = [];

  // 50人ずつに分割してClaudeに送る
  for (let i = 0; i < users.length; i += CLAUDE_BATCH_SIZE) {
    const batch = users.slice(i, i + CLAUDE_BATCH_SIZE);
    const bioList = batch
      .map(u => `@${u.username} | ${u.name} | ${(u.description ?? "").slice(0, 100)}`)
      .join("\n");

    const prompt = `あなたはXアルゴリズム教育の専門家です。
参考アカウント @${sourceUsername} のフォロワーのプロフィールを評価してください。

## 評価基準（6点以上を選別）
- 日本人起業家・スタートアップ創業者・共同創業者
- VC投資家・エンジェル投資家
- スタートアップ系メディア・コミュニティ運営者
- 経営幹部（CTO/CFO/COO）

## 除外するべきアカウント（5点以下）
- 海外アカウント（日本語bioがない）
- 有名人・芸能人・スポーツ選手・企業公式

## プロフィール一覧（@username | 表示名 | bio）
${bioList}

## 出力
6点以上のアカウントのみJSON配列で返してください（説明文不要）:
[{"username":"アカウント名（@なし）","score":8,"reason":"スタートアップCEO"}]`;

    try {
      const result = await callClaude(prompt);
      const match = result.match(/\[[\s\S]*?\]/);
      if (!match) continue;
      const parsed: { username: string; score: number; reason: string }[] = JSON.parse(match[0]);
      results.push(...parsed.filter(p => p.score >= 6));
    } catch {
      // このバッチは失敗してもスキップして続行
      continue;
    }
  }

  return results;
}

// 1回あたりの取得上限（コスト管理）
const MAX_RESULTS_PER_FETCH = 100;

export async function POST(req: NextRequest) {
  const { sourceUsername } = await req.json();
  if (!sourceUsername) return NextResponse.json({ error: "sourceUsernameが必要です" }, { status: 400 });

  // 探索元アカウントのXIdを取得
  let sourceUserId: string;
  const existingRef = await prisma.referenceAccount.findUnique({ where: { xUsername: sourceUsername } });

  if (existingRef?.xId) {
    sourceUserId = existingRef.xId;
  } else {
    const user = await getUserByUsername(sourceUsername);
    if (!user) return NextResponse.json({ error: `@${sourceUsername} が見つかりません` }, { status: 404 });
    sourceUserId = user.id;
    if (existingRef) {
      await prisma.referenceAccount.update({
        where: { id: existingRef.id },
        data: { xId: user.id, displayName: user.name, bio: user.description ?? null },
      });
    }
  }

  // 前回のページネーショントークンを取得
  const state = await prisma.discoveryState.findUnique({ where: { sourceUsername } });
  const paginationToken = state?.paginationToken ?? undefined;

  // フォロワーを取得（コスト管理のため上限100人/回）
  const result = await getUserFollowers(sourceUserId, MAX_RESULTS_PER_FETCH, paginationToken);
  if (!result.success) return NextResponse.json({ error: result.error ?? "フォロワーの取得に失敗しました" }, { status: 500 });

  const { users, nextToken } = result;
  if (users.length === 0) return NextResponse.json({ fetched: 0, filtered: 0, message: "フォロワーが見つかりませんでした" });

  // 既に登録済みのアカウントを除外（参考アカウント・既存候補）
  const existingRefs = await prisma.referenceAccount.findMany({ select: { xUsername: true } });
  const existingCandidates = await prisma.discoveryCandidate.findMany({
    where: { sourceUsername },
    select: { xUsername: true },
  });
  const excludeSet = new Set([
    ...existingRefs.map(r => r.xUsername.toLowerCase()),
    ...existingCandidates.map(c => c.xUsername.toLowerCase()),
  ]);

  const newUsers = users.filter(u => !excludeSet.has(u.username.toLowerCase()));

  // Claude一次選別
  const filtered = newUsers.length > 0 ? await aiFilterCandidates(newUsers, sourceUsername) : [];

  // ユーザーデータをマップに
  const userMap = new Map(newUsers.map(u => [u.username, u]));

  // DBに保存
  if (filtered.length > 0) {
    await prisma.discoveryCandidate.createMany({
      data: filtered.map(f => {
        const u = userMap.get(f.username);
        return {
          sourceUsername,
          xUsername: f.username,
          xId: u?.id ?? "",
          displayName: u?.name ?? null,
          bio: u?.description ?? null,
          followersCount: u?.public_metrics?.followers_count ?? null,
          followingCount: u?.public_metrics?.following_count ?? null,
          tweetCount: u?.public_metrics?.tweet_count ?? null,
          aiScore: f.score,
          aiReason: f.reason,
        };
      }),
    });
  }

  // 探索状態を更新
  await prisma.discoveryState.upsert({
    where: { sourceUsername },
    update: {
      paginationToken: nextToken ?? null,
      totalFetched: (state?.totalFetched ?? 0) + users.length,
    },
    create: {
      sourceUsername,
      sourceUserId,
      paginationToken: nextToken ?? null,
      totalFetched: users.length,
    },
  });

  return NextResponse.json({
    fetched: users.length,
    filtered: filtered.length,
    hasMore: !!nextToken,
    totalFetched: (state?.totalFetched ?? 0) + users.length,
  });
}
