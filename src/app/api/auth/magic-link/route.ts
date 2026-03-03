import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { sendMagicLink } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/library`;
    const token = await createSessionToken(email.trim().toLowerCase());
    const callbackUrl = `${siteUrl.replace(/\/$/, "")}/api/auth/callback?token=${token}&next=${encodeURIComponent(redirectTo)}`;

    await sendMagicLink(email.trim(), callbackUrl);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Magic link:", e);
    const msg = e instanceof Error ? e.message : "Failed to send magic link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
