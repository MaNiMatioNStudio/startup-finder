import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 開発提案一覧（pending のみ、または全件）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const alerts = await prisma.devAlert.findMany({
    where: all ? {} : { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(alerts);
}

// PATCH: ステータス更新（implemented / dismissed）
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json() as { id: string; status: "implemented" | "dismissed" };

  const alert = await prisma.devAlert.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(alert);
}
