import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession, createEmailVerificationToken } from "@/lib/auth/session";
import { sendEmailVerificationEmail } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const rows = await sql`
      SELECT
        ua.email,
        ua.email_verified_at::text,
        ua.verification_sent_at::text,
        p.display_name,
        p.first_name,
        p.last_name
      FROM user_auth ua
      LEFT JOIN profiles p ON p.email = ua.email
      WHERE ua.email = ${session.email}
      LIMIT 1
    ` as {
      email: string;
      email_verified_at: string | null;
      verification_sent_at: string | null;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }[];

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (row.email_verified_at) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    if (row.verification_sent_at) {
      const sentAt = new Date(row.verification_sent_at).getTime();
      const waitMs = RESEND_COOLDOWN_MS - (Date.now() - sentAt);
      if (waitMs > 0) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(waitMs / 1000)} seconds before resending.`, retryAfterSeconds: Math.ceil(waitMs / 1000) },
          { status: 429 }
        );
      }
    }

    const token = await createEmailVerificationToken(row.email);
    const verifyLink = `${SITE_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const name = row.display_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
    await sendEmailVerificationEmail(row.email, verifyLink, name);
    await sql`UPDATE user_auth SET verification_sent_at = NOW(), updated_at = NOW() WHERE email = ${row.email}`;

    return NextResponse.json({ success: true, alreadyVerified: false });
  } catch (e) {
    console.error("Resend verification:", e);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
}
