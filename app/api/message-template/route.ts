import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolveMessageTemplate, applyMessageTemplateFeedback } from "@/lib/claude";

export async function GET() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: { versionNumber: "desc" } });
  return NextResponse.json(templates);
}

// POST: evolve template from edited messages
export async function POST() {
  const current = await prisma.messageTemplate.findFirst({ where: { isActive: true } });
  if (!current) return NextResponse.json({ error: "No active template" }, { status: 400 });

  const editedMessages = await prisma.outreachMessage.findMany({
    where: { editedText: { not: null } },
    include: { candidate: { select: { xUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (editedMessages.length === 0) {
    return NextResponse.json({ error: "修正済みメッセージがありません" }, { status: 400 });
  }

  const result = await evolveMessageTemplate({
    currentTemplate: current.content,
    editedMessages: editedMessages.map((m) => ({
      generated: m.generatedText,
      edited: m.editedText!,
      candidateName: m.candidate.xUsername,
    })),
  });

  await prisma.messageTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });

  const newTemplate = await prisma.messageTemplate.create({
    data: {
      version: `v${current.versionNumber + 1}.0`,
      versionNumber: current.versionNumber + 1,
      content: result.newTemplateContent,
      isActive: true,
      reasoning: result.reasoning.slice(0, 500),
    },
  });

  return NextResponse.json({ newTemplate, reasoning: result.reasoning, changes: result.changes });
}

// PUT: evolve template from qualitative feedback
export async function PUT(req: NextRequest) {
  const { feedback } = await req.json() as { feedback: string };

  if (!feedback?.trim()) {
    return NextResponse.json({ error: "フィードバックを入力してください" }, { status: 400 });
  }

  const current = await prisma.messageTemplate.findFirst({ where: { isActive: true } });
  if (!current) return NextResponse.json({ error: "No active template" }, { status: 400 });

  const result = await applyMessageTemplateFeedback({
    feedback,
    currentTemplate: current.content,
  });

  await prisma.messageTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });

  const newTemplate = await prisma.messageTemplate.create({
    data: {
      version: `v${current.versionNumber + 1}.0`,
      versionNumber: current.versionNumber + 1,
      content: result.newTemplateContent,
      isActive: true,
      reasoning: result.reasoning.slice(0, 500),
    },
  });

  return NextResponse.json({ newTemplate, reasoning: result.reasoning, changes: result.changes });
}
