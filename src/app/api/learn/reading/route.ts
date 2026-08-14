import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** GET /api/learn/reading — list reading posts (slug, title) for sandbox picker. */
export async function GET() {
  if (!sql) return NextResponse.json({ readings: [] });
  try {
    const rows = await sql`
      SELECT p.slug, p.title
      FROM posts p
      WHERE p.content_type = 'reading' AND p.status = 'published'
      ORDER BY p.title NULLS LAST
      LIMIT 100
    ` as { slug: string; title: string }[];
    return NextResponse.json({ readings: rows ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list readings", readings: [] }, { status: 500 });
  }
}
