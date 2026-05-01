import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserByUsername } from "@/lib/x-api";

export async function GET() {
  const accounts = await prisma.referenceAccount.findMany({
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { username, reason } = await req.json();
  const clean = username.replace(/^@/, "").trim();

  const existing = await prisma.referenceAccount.findUnique({ where: { xUsername: clean } });
  if (existing) return NextResponse.json({ error: "すでに追加済みです" }, { status: 400 });

  let xId: string | null = null;
  let displayName: string | null = null;
  let bio: string | null = null;
  try {
    const user = await getUserByUsername(clean);
    if (user) {
      xId = user.id;
      displayName = user.name;
      bio = user.description ?? null;
    }
  } catch {
    // プロフィール取得失敗は無視して追加続行
  }

  const account = await prisma.referenceAccount.create({
    data: { xUsername: clean, xId, displayName, bio, reason: reason ?? null },
  });
  return NextResponse.json({ account });
}
