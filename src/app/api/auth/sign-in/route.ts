import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { logError } from "@/lib/error-log";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, redirect: redirectParam } = body as { email?: string; password?: string; redirect?: string };
    const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimmed || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const rows = await sql`
      SELECT email, password_hash, salt FROM user_auth WHERE email = ${trimmed} LIMIT 1
    ` as { email: string; password_hash: string; salt: string }[];

    const row = rows?.[0];
    if (!row || !verifyPassword(password, row.password_hash, row.salt)) {
      await logError("sign-in", "Invalid email or password", { email: trimmed });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const sessionToken = await createSessionToken(row.email);
    try {
      await sql`UPDATE profiles SET last_login_at = NOW(), updated_at = NOW() WHERE email = ${row.email}`;
    } catch {
      // ignore if column missing
    }
    const redirectTo = typeof redirectParam === "string" ? redirectParam : "/learn/dashboard";
    const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/learn/dashboard";

    const res = NextResponse.json({ success: true, redirect: safeRedirect });
    res.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("Sign-in:", e);
    await logError("sign-in", e instanceof Error ? e.message : "Failed to sign in", { err: String(e) });
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }
}
