// X (Twitter) API v2 client
// Uses Bearer Token for app-only authentication (Basic tier: $100/month required for search)

const X_API_BASE = "https://api.twitter.com/2";

async function xFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${X_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
    },
    // Disable Next.js fetch cache for API calls
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X API ${res.status}: ${err}`);
  }

  return res.json();
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface XTweet {
  id: string;
  text: string;
  authorId?: string;
  created_at?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

export async function searchRecentTweets(
  query: string,
  nextToken?: string
): Promise<{
  tweets: XTweet[];
  nextToken?: string;
  userIds: string[];
  userObjects: XUser[];
}> {
  const params: Record<string, string> = {
    query,
    max_results: "10",
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "description,public_metrics,username",
  };
  if (nextToken) params.next_token = nextToken;

  const data = await xFetch("/tweets/search/recent", params);

  const tweets: XTweet[] = (data.data || []).map((t: {
    id: string; text: string; author_id?: string;
    created_at?: string; public_metrics?: XTweet["public_metrics"];
  }) => ({
    id: t.id,
    text: t.text,
    authorId: t.author_id,
    created_at: t.created_at,
    public_metrics: t.public_metrics,
  }));

  const userObjects: XUser[] = data.includes?.users ?? [];
  const userIds: string[] = userObjects.map((u: XUser) => u.id);

  return {
    tweets,
    nextToken: data.meta?.next_token,
    userIds,
    userObjects,
  };
}

export async function getUserById(userId: string): Promise<XUser | null> {
  try {
    const data = await xFetch(`/users/${userId}`, {
      "user.fields": "description,public_metrics",
    });
    return data.data || null;
  } catch {
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<XUser | null> {
  const data = await xFetch(`/users/by/username/${username}`, {
    "user.fields": "description,public_metrics",
  });
  return data.data || null;
}

export async function getUserFollowers(
  userId: string,
  maxResults = 100,
  paginationToken?: string
): Promise<{ users: XUser[]; nextToken?: string; success: boolean; error?: string }> {
  try {
    const params: Record<string, string> = {
      max_results: String(Math.min(maxResults, 1000)),
      "user.fields": "description,public_metrics,username",
    };
    if (paginationToken) params.pagination_token = paginationToken;

    const data = await xFetch(`/users/${userId}/followers`, params);
    return {
      users: data.data || [],
      nextToken: data.meta?.next_token,
      success: true,
    };
  } catch (err) {
    return { users: [], success: false, error: String(err) };
  }
}

export async function getUserTweets(
  userId: string,
  maxResults = 10
): Promise<XTweet[]> {
  try {
    const data = await xFetch(`/users/${userId}/tweets`, {
      max_results: String(Math.min(maxResults, 100)),
      "tweet.fields": "created_at,public_metrics",
      exclude: "retweets,replies",
    });
    return data.data || [];
  } catch {
    return [];
  }
}
