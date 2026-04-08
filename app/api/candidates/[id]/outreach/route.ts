import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOutreachMessage } from "@/lib/claude";

// POST: generate a new outreach message
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const template = await prisma.messageTemplate.findFirst({ where: { isActive: true } });
  if (!template) return NextResponse.json({ error: "No active message template" }, { status: 400 });

  // Past edited messages for this candidate (learning context)
  const pastMessages = await prisma.outreachMessage.findMany({
    where: { editedText: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const tweets: string[] = candidate.sampleTweets ? JSON.parse(candidate.sampleTweets) : [];

  const result = await generateOutreachMessage({
    templateContent: template.content,
    candidate: {
      username: candidate.xUsername,
      displayName: candidate.displayName,
      bio: candidate.bio,
      tweets,
    },
    pastEditedMessages: pastMessages
      .filter((m) => m.editedText)
      .map((m) => ({ generated: m.generatedText, edited: m.editedText! })),
  });

  const message = await prisma.outreachMessage.create({
    data: {
      candidateId: id,
      templateId: template.id,
      generatedText: result.message,
      sources: JSON.stringify(result.sources),
    },
  });

  return NextResponse.json({ ...message, sources: result.sources });
}

// PATCH: save edited version
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { messageId, editedText } = await req.json() as { messageId: string; editedText: string };

  const message = await prisma.outreachMessage.update({
    where: { id: messageId },
    data: { editedText },
  });

  return NextResponse.json(message);
}

// GET: get existing messages for candidate
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const messages = await prisma.outreachMessage.findMany({
    where: { candidateId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages);
}
