import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyNeonAuthToken } from "@/lib/neon-auth";
import { createSessionToken } from "@/lib/auth/session";

const COOKIE_NAME = "auth_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Callback for Neon Auth OAuth. Expects ?token=<jwt> or ?code= (future).
 * Verifies the JWT with Neon Auth JWKS, then sets our session cookie and redirects.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const nextUrl = url.searchParams.get("next") || "/library";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", url.origin));
  }

  const payload = await verifyNeonAuthToken(token);
  if (!payload?.email) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", url.origin));
  }

  const sessionToken = await createSessionToken(payload.email);
  const store = await cookies();
  store.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return NextResponse.redirect(new URL(nextUrl, url.origin));
}
