import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actions = await prisma.trainingAction.findMany({
    orderBy: { executedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ actions });
}
