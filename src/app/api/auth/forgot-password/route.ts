import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createResetToken } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function POST(req: Request) {
  try {
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

    if (exists) {
      const token = await createResetToken(email);
      const resetLink = `${SITE_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(email, resetLink);
      return NextResponse.json({
        success: true,
        message: "We've sent a reset link. Check your inbox.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "No account found with this email. Please sign up.",
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
