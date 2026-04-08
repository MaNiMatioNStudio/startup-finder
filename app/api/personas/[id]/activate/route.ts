import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.personaPrompt.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const persona = await prisma.personaPrompt.update({
    where: { id },
    data: { isActive: true },
  });

  return NextResponse.json(persona);
}
