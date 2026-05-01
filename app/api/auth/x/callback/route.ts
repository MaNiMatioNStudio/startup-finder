import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/training-account?error=${error}`, req.url));
  }

  const savedState = req.cookies.get("x_oauth_state")?.value;
  const codeVerifier = req.cookies.get("x_code_verifier")?.value;

  if (!code || !state || !savedState || !codeVerifier || state !== savedState) {
    return NextResponse.redirect(new URL("/training-account?error=invalid_state", req.url));
  }

  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const { origin } = new URL(req.url);
  const callbackBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
  const callbackUrl = `${callbackBase}/api/auth/x/callback`;

  // トークン取得
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.redirect(new URL(`/training-account?error=${encodeURIComponent(err)}`, req.url));
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  // ユーザー情報取得
  const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=description,public_metrics", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userData = await userRes.json();
  const user = userData.data;

  const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  // DB保存（upsert）
  await prisma.trainingAccount.upsert({
    where: { xUsername: user.username },
    create: {
      xUsername: user.username,
      xId: user.id,
      displayName: user.name,
      accessToken: access_token,
      refreshToken: refresh_token ?? null,
      tokenExpiresAt,
      scopes: JSON.stringify(["tweet.read", "users.read", "follows.write", "like.write", "offline.access"]),
    },
    update: {
      accessToken: access_token,
      refreshToken: refresh_token ?? null,
      tokenExpiresAt,
      displayName: user.name,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  const redirectBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
  const response = NextResponse.redirect(new URL("/training-account?success=1", redirectBase));
  response.cookies.delete("x_oauth_state");
  response.cookies.delete("x_code_verifier");
  return response;
}
