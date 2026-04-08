import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const personas = await prisma.personaPrompt.findMany({
    orderBy: { versionNumber: "desc" },
    include: {
      _count: { select: { candidates: true } },
    },
  });

  const withScores = await Promise.all(
    personas.map(async (p) => {
      const batches = await prisma.feedbackBatch.findMany({
        where: { personaPromptId: p.id, averageScore: { not: null } },
        select: { averageScore: true },
      });
      const avgScore =
        batches.length > 0
          ? batches.reduce((s, b) => s + (b.averageScore ?? 0), 0) / batches.length
          : null;

      return { ...p, actualScore: avgScore, candidateCount: p._count.candidates };
    })
  );

  return NextResponse.json(withScores);
}

export async function POST(req: NextRequest) {
  const { content, reasoning } = await req.json();

  const latest = await prisma.personaPrompt.findFirst({
    orderBy: { versionNumber: "desc" },
  });

  const nextNumber = (latest?.versionNumber ?? 0) + 1;
  const version = `v${nextNumber}.0`;

  // Deactivate current active
  await prisma.personaPrompt.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const persona = await prisma.personaPrompt.create({
    data: {
      version,
      versionNumber: nextNumber,
      content,
      isActive: true,
      reasoning,
    },
  });

  return NextResponse.json(persona);
}
