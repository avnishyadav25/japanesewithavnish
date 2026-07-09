import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { sendMagicLink } from "@/lib/email";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    // Only mint a session for emails we already know (registered account,
    // buyer, or entitlement holder). Respond with success either way so the
    // endpoint can't be used to probe which emails exist.
    if (sql) {
      const known = (await sql`
        SELECT 1 FROM user_auth WHERE lower(email) = ${normalized}
        UNION ALL
        SELECT 1 FROM orders WHERE lower(user_email) = ${normalized}
        UNION ALL
        SELECT 1 FROM entitlements WHERE lower(user_email) = ${normalized}
        LIMIT 1
      `) as unknown[];
      if (known.length === 0) {
        return NextResponse.json({ success: true });
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/library`;
    const token = await createSessionToken(normalized);
    const callbackUrl = `${siteUrl.replace(/\/$/, "")}/api/auth/callback?token=${token}&next=${encodeURIComponent(redirectTo)}`;

    await sendMagicLink(email.trim(), callbackUrl);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Magic link:", e);
    const msg = e instanceof Error ? e.message : "Failed to send magic link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
