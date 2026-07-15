import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { verifyResetToken } from "@/lib/auth/session";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, newPassword } = body as { token?: string; newPassword?: string };
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const payload = await verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { hash, salt } = hashPassword(newPassword);
    // Upsert rather than UPDATE-only: a session can exist (via magic link, tied to an
    // `orders`/`entitlements` row) without ever having a `user_auth` row, e.g. after
    // redeeming a free-coupon order. This lets the same link create the first password.
    const result = await sql`
      INSERT INTO user_auth (email, password_hash, salt, updated_at)
      VALUES (${payload.email}, ${hash}, ${salt}, NOW())
      ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}, salt = ${salt}, updated_at = NOW()
      RETURNING email
    ` as { email: string }[];
    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const sessionToken = await createSessionToken(payload.email);
    const res = NextResponse.json({
      success: true,
      redirect: "/learn/dashboard",
    });
    res.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("Reset password:", e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
