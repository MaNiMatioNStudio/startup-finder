import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/claude";

export async function POST() {
  const scoredPosts = await prisma.timelinePost.findMany({
    where: { score: { not: null } },
    orderBy: { scoredAt: "desc" },
    take: 50,
  });

  if (scoredPosts.length === 0) {
    return NextResponse.json({ error: "採点済みの投稿がありません" }, { status: 400 });
  }

  const references = await prisma.referenceAccount.findMany();
  const currentStrategy = await prisma.trainingStrategy.findFirst({ where: { isActive: true }, orderBy: { generation: "desc" } });
  const rejectedAccounts = await prisma.accountFeedback.findMany({
    where: { action: "rejected" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const highScore = scoredPosts.filter(p => (p.score ?? 0) >= 7);
  const lowScore = scoredPosts.filter(p => (p.score ?? 0) <= 3);

  const prompt = `あなたはXのアルゴリズム教育の専門家です。

## 目的
教育型Xアカウントのタイムラインに「日本人起業家・スタートアップ創業者」のコンテンツが多く流れるよう、フォロー/いいね戦略を最適化してください。

## 現在の参考アカウント（理想とするコンテンツの発信者）
${references.map(r => `- @${r.xUsername}${r.displayName ? ` (${r.displayName})` : ""}${r.reason ? `: ${r.reason}` : ""}`).join("\n")}

## 高評価（7-10点）の投稿サンプル（これがタイムラインに来てほしい）
${highScore.slice(0, 10).map(p => `[${p.score}点] @${p.authorUsername ?? "不明"}: ${p.content.slice(0, 100)}`).join("\n") || "なし"}

## 低評価（0-3点）の投稿サンプル（これはタイムラインに来てほしくない）
${lowScore.slice(0, 10).map(p => `[${p.score}点] @${p.authorUsername ?? "不明"}: ${p.feedback ? `FB: ${p.feedback} ` : ""}${p.content.slice(0, 100)}`).join("\n") || "なし"}

${rejectedAccounts.length > 0 ? `## AIが提案したが追加しなかったアカウント（改善のヒント）
${rejectedAccounts.map(r => `- @${r.xUsername}[${r.score}点]: ${r.reason ?? "理由なし"}${r.bio ? ` bio: ${r.bio.slice(0, 60)}` : ""}`).join("\n")}` : ""}

${currentStrategy ? `## 現在の運用ストラテジー（第${currentStrategy.generation}世代）\n${currentStrategy.content}` : ""}

## 出力形式
以下の3セクションで回答してください：

### 分析
高評価・低評価の傾向と、追加しなかったアカウントの傾向から何が読み取れるか（3-5行）

### 改善されたストラテジー
次の運用方針を具体的に記述（どのタイプのアカウントをフォロー/いいねすべきか、避けるべきタイプも含めて）

### 追加推奨アカウント
参考アカウントに追加すると良いアカウントタイプ（具体的な特徴を3つ）`;

  const result = await callClaude(prompt);

  const lastGen = currentStrategy?.generation ?? 0;
  await prisma.trainingStrategy.updateMany({ data: { isActive: false } });
  const strategy = await prisma.trainingStrategy.create({
    data: { content: result, generation: lastGen + 1, isActive: true },
  });

  return NextResponse.json({ ok: true, strategy });
}
