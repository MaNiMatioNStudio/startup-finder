import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ユーザーの評価（follow/skip）を保存
export async function POST(req: NextRequest) {
  const { evaluations }: { evaluations: { id: string; action: "follow" | "skip" }[] } = await req.json();

  if (!evaluations?.length) return NextResponse.json({ ok: true, updated: 0 });

  let updated = 0;
  for (const e of evaluations) {
    await prisma.discoveryCandidate.update({
      where: { id: e.id },
      data: { userAction: e.action },
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
