import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// force-dynamic: this query's start_at/end_at NOW() window and active flag must be evaluated
// fresh on every request — without this, Next's Data Cache can freeze the result (including
// across dev-server restarts via the on-disk fetch cache), making a banner stay "active" past
// its end_at or never appear once its start_at arrives.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!sql) return NextResponse.json({ banner: null });

  try {
    const rows = await sql`
      SELECT id, title, message, link_url, image_url
      FROM offer_banners
      WHERE active = true
        AND (start_at IS NULL OR start_at <= NOW())
        AND (end_at IS NULL OR end_at >= NOW())
      ORDER BY priority DESC, created_at DESC
      LIMIT 1
    `;
    return NextResponse.json({ banner: rows?.[0] ?? null });
  } catch (e) {
    console.error("Active offer banner:", e);
    return NextResponse.json({ banner: null });
  }
}
