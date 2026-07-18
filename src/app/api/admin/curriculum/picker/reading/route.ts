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
    SELECT r.id, p.slug, p.title, r.level
    FROM reading r
    JOIN posts p ON p.id = r.post_id AND p.content_type = 'reading'
    WHERE (p.title ILIKE ${`%${q}%`} OR r.title ILIKE ${`%${q}%`} OR p.slug ILIKE ${`%${q}%`})
    ORDER BY p.title
    LIMIT ${limit}
  `;
  return NextResponse.json(rows);
}
