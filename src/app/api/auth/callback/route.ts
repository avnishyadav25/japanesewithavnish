import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { recordLoginEvent } from "@/lib/auth/loginEvents";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const nextUrl = req.nextUrl.searchParams.get("next") || "/library";
  const safeNext = nextUrl.startsWith("/") ? nextUrl : "/library";

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url));
  }

  const sessionToken = await createSessionToken(payload.email);
  await recordLoginEvent(payload.email, req);
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
