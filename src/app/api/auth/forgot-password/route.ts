import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createResetToken } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(`forgot-password:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Something went wrong. Try again later." }, { status: 503 });
    }

    const rows = await sql`
      SELECT 1 FROM user_auth WHERE email = ${email} LIMIT 1
    ` as { email?: string }[];
    const exists = Array.isArray(rows) && rows.length > 0;

    // Respond with the identical shape/message either way so this endpoint can't be used to
    // probe which emails are registered (matches the pattern in auth/magic-link/route.ts).
    if (exists) {
      const token = await createResetToken(email);
      const resetLink = `${SITE_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(email, resetLink);
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists for this email, we've sent a reset link.",
    });
  } catch (e) {
    console.error("Forgot password:", e);
    const { logError } = await import("@/lib/error-log");
    await logError("forgot-password", e instanceof Error ? e.message : "Forgot password failed", { err: String(e) });
    return NextResponse.json(
      { error: "Something went wrong. Try again later." },
      { status: 500 }
    );
  }
}
