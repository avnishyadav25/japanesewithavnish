import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT clk.id, clk.lesson_id, clk.kana_id, clk.sort_order, k.character, k.type, k.romaji, k.row_label
    FROM curriculum_lesson_kana clk
    JOIN kana k ON k.id = clk.kana_id
    WHERE clk.lesson_id = ${lessonId}
    ORDER BY clk.sort_order, k.romaji
  `;
  return NextResponse.json(rows as { id: string; lesson_id: string; kana_id: string; sort_order: number; character: string; type: string; romaji: string; row_label: string | null }[]);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { kana_id, sort_order } = body;
  if (!kana_id || typeof kana_id !== "string") {
    return NextResponse.json({ error: "kana_id required" }, { status: 400 });
  }
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO curriculum_lesson_kana (lesson_id, kana_id, sort_order)
    VALUES (${lessonId}, ${kana_id}, ${sort})
    ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id, lesson_id, kana_id, sort_order
  `;
  const row = (rows as { id: string; lesson_id: string; kana_id: string; sort_order: number }[])[0];
  return NextResponse.json(row);
}
