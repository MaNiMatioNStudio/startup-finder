import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const posts = await prisma.timelinePost.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ posts });
}

export async function PATCH(req: NextRequest) {
  const { scores }: { scores: { id: string; score: number; feedback?: string }[] } = await req.json();

  await Promise.all(scores.map(s =>
    prisma.timelinePost.update({
      where: { id: s.id },
      data: { score: s.score, feedback: s.feedback ?? null, scoredAt: new Date() },
    })
  ));

  return NextResponse.json({ ok: true });
}
