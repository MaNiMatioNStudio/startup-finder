import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/claude";
import { getUserByUsername } from "@/lib/x-api";

export async function POST() {
  const strategy = await prisma.trainingStrategy.findFirst({
    where: { isActive: true },
    orderBy: { generation: "desc" },
  });
  if (!strategy) return NextResponse.json({ error: "ストラテジーがありません。先にストラテジーを生成してください。" }, { status: 400 });

  const existing = await prisma.referenceAccount.findMany({ select: { xUsername: true } });
  const existingNames = existing.map(r => r.xUsername);

  const prompt = `あなたはXアルゴリズム教育の専門家です。

## 現在のストラテジー
${strategy.content}

## 既存の参考アカウント（追加不要）
${existingNames.map(n => `@${n}`).join(", ")}

## タスク
ストラテジーの方向性に合った、日本人起業家・スタートアップ関係者のXアカウントを最大5件提案してください。
既存アカウントは除外してください。
実在する可能性が高いアカウントのみ挙げてください（著名な起業家、VC、スタートアップCEO等）。

## 出力
JSON配列のみを返してください（説明文不要）:
[{"username":"アカウント名（@なし）","reason":"なぜこのアカウントが有効か（1行）"}]`;

  const result = await callClaude(prompt);
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) return NextResponse.json({ suggestions: [] });

  let suggestions: { username: string; reason: string }[] = [];
  try {
    suggestions = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  // X APIで実在確認（存在するアカウントのみ返す）
  const verified = await Promise.all(
    suggestions.map(async s => {
      if (existingNames.includes(s.username)) return null;
      try {
        const user = await getUserByUsername(s.username);
        if (!user) return null;
        return {
          username: s.username,
          displayName: user.name,
          bio: user.description ?? null,
          reason: s.reason,
          xId: user.id,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json({ suggestions: verified.filter(Boolean) });
}
