import { prisma } from "./prisma";

const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export interface ActiveAccount {
  id: string;
  xId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
}

// アクセストークンをリフレッシュしてDBを更新、新しいトークンを返す
async function refreshToken(accountId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  const { access_token, refresh_token: new_refresh, expires_in } = data;
  const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  await prisma.trainingAccount.update({
    where: { id: accountId },
    data: {
      accessToken: access_token,
      refreshToken: new_refresh ?? refreshToken,
      tokenExpiresAt,
      updatedAt: new Date(),
    },
  });

  return access_token;
}

// 有効なアクセストークンを取得（期限切れなら自動リフレッシュ）
export async function getValidToken(): Promise<{ token: string | null; error: string | null }> {
  const account = await prisma.trainingAccount.findFirst({ where: { isActive: true } });
  if (!account) return { token: null, error: "連携アカウントがありません" };

  const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : false;

  if (!isExpired) {
    return { token: account.accessToken, error: null };
  }

  // 期限切れ → リフレッシュを試みる
  if (!account.refreshToken) {
    return { token: null, error: "トークンが期限切れです。再連携してください。" };
  }

  const newToken = await refreshToken(account.id, account.refreshToken);
  if (!newToken) {
    return { token: null, error: "トークンの更新に失敗しました。再連携してください。" };
  }

  return { token: newToken, error: null };
}
