import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  INITIAL_PERSONA_PROMPT,
  INITIAL_EXTRACTION_PROMPT,
  INITIAL_EVALUATION_PROMPT,
  INITIAL_MESSAGE_TEMPLATE,
} from "@/lib/seed-data";

export async function POST() {
  const existing = await prisma.personaPrompt.count();
  if (existing > 0) {
    // Seed message template if missing
    const tmplCount = await prisma.messageTemplate.count();
    if (tmplCount === 0) {
      await prisma.messageTemplate.create({
        data: { version: "v1.0", versionNumber: 1, content: INITIAL_MESSAGE_TEMPLATE, isActive: true },
      });
      return NextResponse.json({ message: "Message template seeded" });
    }
    return NextResponse.json({ message: "Already seeded" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.personaPrompt.create({
      data: { version: "v1.0", versionNumber: 1, content: INITIAL_PERSONA_PROMPT, isActive: true, reasoning: "初期ペルソナプロンプト" },
    });
    await tx.extractionPrompt.create({
      data: { version: "v1.0", content: INITIAL_EXTRACTION_PROMPT, isActive: true },
    });
    await tx.evaluationPrompt.create({
      data: { version: "v1.0", content: INITIAL_EVALUATION_PROMPT, isActive: true },
    });
    await tx.messageTemplate.create({
      data: { version: "v1.0", versionNumber: 1, content: INITIAL_MESSAGE_TEMPLATE, isActive: true },
    });
  });

  return NextResponse.json({ message: "Seeded successfully" });
}
