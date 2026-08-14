import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyEmailVerificationToken } from "@/lib/auth/session";

function redirectTo(req: NextRequest, path: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  return NextResponse.redirect(`${baseUrl}${path}`);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token || !sql) {
    return redirectTo(req, "/login?verification=failed");
  }

  const payload = await verifyEmailVerificationToken(token);
  if (!payload?.email) {
    return redirectTo(req, "/login?verification=failed");
  }

  try {
    const rows = await sql`
      UPDATE user_auth
      SET email_verified_at = NOW(), updated_at = NOW()
      WHERE email = ${payload.email}
      RETURNING email
    ` as { email: string }[];

    if (!rows?.[0]) {
      return redirectTo(req, "/login?verification=failed");
    }

    return redirectTo(req, "/learn/dashboard?verified=1");
  } catch (e) {
    console.error("Verify email:", e);
    return redirectTo(req, "/login?verification=failed");
  }
}
