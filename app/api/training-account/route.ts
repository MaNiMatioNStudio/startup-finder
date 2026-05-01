import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const account = await prisma.trainingAccount.findFirst({
    where: { isActive: true },
    select: { id: true, xUsername: true, displayName: true, tokenExpiresAt: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ account });
}

export async function DELETE() {
  await prisma.trainingAccount.updateMany({ data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
