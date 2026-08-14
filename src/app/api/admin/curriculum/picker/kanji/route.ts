import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10)));
  const rows = await sql`
    SELECT k.id, p.slug, p.title, k.character, k.meaning
    FROM kanji k
    JOIN posts p ON p.id = k.post_id AND p.content_type = 'kanji'
    WHERE (k.character ILIKE ${`%${q}%`} OR k.meaning ILIKE ${`%${q}%`} OR p.title ILIKE ${`%${q}%`} OR p.slug ILIKE ${`%${q}%`})
    ORDER BY k.character NULLS LAST, p.title
    LIMIT ${limit}
  `;
  return NextResponse.json(rows as { id: string; slug: string; title: string | null; character: string | null; meaning: string | null }[]);
}
