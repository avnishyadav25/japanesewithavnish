import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const type = req.nextUrl.searchParams.get("type") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10)));

  const validType = type === "hiragana" || type === "katakana" ? type : null;
  const pattern = q.trim() ? `%${q.trim()}%` : null;

  let rows: { id: string; character: string; type: string; romaji: string; row_label: string | null }[];
  if (pattern && validType) {
    rows = (await sql`
      SELECT id, character, type, romaji, row_label FROM kana
      WHERE type = ${validType} AND (character ILIKE ${pattern} OR romaji ILIKE ${pattern} OR row_label ILIKE ${pattern})
      ORDER BY sort_order, romaji LIMIT ${limit}
    `) as typeof rows;
  } else if (pattern) {
    rows = (await sql`
      SELECT id, character, type, romaji, row_label FROM kana
      WHERE character ILIKE ${pattern} OR romaji ILIKE ${pattern} OR row_label ILIKE ${pattern}
      ORDER BY type, sort_order, romaji LIMIT ${limit}
    `) as typeof rows;
  } else if (validType) {
    rows = (await sql`
      SELECT id, character, type, romaji, row_label FROM kana
      WHERE type = ${validType} ORDER BY sort_order, romaji LIMIT ${limit}
    `) as typeof rows;
  } else {
    rows = (await sql`
      SELECT id, character, type, romaji, row_label FROM kana
      ORDER BY type, sort_order, romaji LIMIT ${limit}
    `) as typeof rows;
  }
  return NextResponse.json(rows);
}
