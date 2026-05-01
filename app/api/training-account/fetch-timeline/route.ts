import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/lib/x-auth";

const X_API_BASE = "https://api.twitter.com/2";

async function fetchUserTweets(userId: string, token: string): Promise<{ id: string; text: string; authorId: string }[]> {
  const url = `${X_API_BASE}/users/${userId}/tweets?max_results=5&tweet.fields=created_at&exclude=retweets,replies`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data ?? []).map((t: { id: string; text: string }) => ({
    id: t.id,
    text: t.text,
    authorId: userId,
  }));
}

export async function POST() {
  const { token, error: tokenError } = await getValidToken();
  if (!token) return NextResponse.json({ error: tokenError }, { status: 401 });

  const references = await prisma.referenceAccount.findMany();
  if (references.length === 0) {
    return NextResponse.json({ error: "参考アカウントがありません。先に参考アカウントを追加してください。" }, { status: 400 });
  }

  let added = 0;
  let total = 0;
  const errors: string[] = [];

  for (const ref of references) {
    if (!ref.xId) continue;

    const tweets = await fetchUserTweets(ref.xId, token);
    total += tweets.length;

    for (const tweet of tweets) {
      try {
        const existing = await prisma.timelinePost.findUnique({ where: { tweetId: tweet.id } });
        if (existing) continue;
        await prisma.timelinePost.create({
          data: {
            tweetId: tweet.id,
            authorUsername: ref.xUsername,
            content: tweet.text,
          },
        });
        added++;
      } catch (e) {
        errors.push(`@${ref.xUsername}: ${String(e)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, added, total, errors: errors.length > 0 ? errors : undefined });
}
