import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createEmailVerificationToken } from "@/lib/auth/session";
import { sendEmailVerificationEmail } from "@/lib/email";
import { logError } from "@/lib/error-log";

const MIN_PASSWORD_LENGTH = 8;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, first_name: fn, last_name: ln } = body as {
      email?: string;
      password?: string;
      first_name?: string;
      last_name?: string;
    };
    const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const firstName = trimStr(fn);
    const lastName = trimStr(ln);
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const existing = await sql`
      SELECT 1 FROM user_auth WHERE email = ${trimmed} LIMIT 1
    `;
    if (Array.isArray(existing) && existing.length > 0) {
      await logError("sign-up", "Already registered", { email: trimmed });
      return NextResponse.json(
        { error: "Already registered. Sign in or use forgot password." },
        { status: 409 }
      );
    }

    const { hash, salt } = hashPassword(password);
    await sql`
      INSERT INTO user_auth (email, password_hash, salt, updated_at)
      VALUES (${trimmed}, ${hash}, ${salt}, NOW())
    `;

    try {
      await sql`
        INSERT INTO profiles (email, first_name, last_name, display_name, updated_at)
        VALUES (${trimmed}, ${firstName || null}, ${lastName || null}, ${displayName}, NOW())
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
          last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
          display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
          updated_at = NOW()
      `;
    } catch (profErr) {
      await logError("sign-up", "Profiles insert failed", { email: trimmed, err: String(profErr) });
      // continue; user is created in user_auth
    }

    let verificationEmailSent = false;
    try {
      const token = await createEmailVerificationToken(trimmed);
      const verifyLink = `${SITE_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmailVerificationEmail(trimmed, verifyLink, displayName);
      await sql`UPDATE user_auth SET verification_sent_at = NOW(), updated_at = NOW() WHERE email = ${trimmed}`;
      verificationEmailSent = true;
    } catch (emailErr) {
      await logError("sign-up", "Verification email send failed", {
        email: trimmed,
        err: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({ success: true, verificationEmailSent });
  } catch (e) {
    console.error("Sign-up:", e);
    await logError("sign-up", e instanceof Error ? e.message : "Failed to sign up", { err: String(e) });
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}
