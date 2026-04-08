import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.candidateEvaluation.deleteMany({ where: { candidateId: id } });
  await prisma.humanFeedback.deleteMany({ where: { candidateId: id } });
  await prisma.candidate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
