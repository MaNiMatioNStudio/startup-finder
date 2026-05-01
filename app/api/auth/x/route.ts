import { NextResponse } from "next/server";
import crypto from "crypto";

const SCOPES = ["tweet.read", "users.read", "follows.write", "like.write", "offline.access"];

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function GET(req: Request) {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "X_CLIENT_ID が設定されていません" }, { status: 400 });
  }

  // PKCE
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  // ngrok経由の場合はx-forwarded-hostを優先（localhost直アクセスにも対応）
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const { origin } = new URL(req.url);
  const callbackBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
  const callbackUrl = `${callbackBase}/api/auth/x/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  // stateとverifierをcookieに一時保存（10分）
  response.cookies.set("x_oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "lax" });
  response.cookies.set("x_code_verifier", codeVerifier, { httpOnly: true, maxAge: 600, sameSite: "lax" });

  return response;
}
