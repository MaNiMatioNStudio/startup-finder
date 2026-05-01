import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const strategies = await prisma.trainingStrategy.findMany({
    orderBy: { generation: "desc" },
  });
  return NextResponse.json({ strategies });
}
