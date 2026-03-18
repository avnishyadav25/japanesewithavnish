import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const body = await req.json();
  const sentence_ja = typeof body.sentence_ja === "string" ? body.sentence_ja.trim() : undefined;
  const sentence_romaji = body.sentence_romaji !== undefined ? (typeof body.sentence_romaji === "string" ? body.sentence_romaji.trim() || null : null) : undefined;
  const sentence_en = typeof body.sentence_en === "string" ? body.sentence_en.trim() : undefined;
  const notes = body.notes !== undefined ? (typeof body.notes === "string" ? body.notes.trim() || null : null) : undefined;
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : undefined;
  if (sentence_ja === undefined && sentence_romaji === undefined && sentence_en === undefined && notes === undefined && sort_order === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  const existing = (await sql`SELECT sentence_ja, sentence_romaji, sentence_en, notes, sort_order FROM examples WHERE id = ${id} LIMIT 1`) as { sentence_ja: string; sentence_romaji: string | null; sentence_en: string; notes: string | null; sort_order: number }[];
  if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cur = existing[0];
  await sql`
    UPDATE examples SET
      sentence_ja = ${sentence_ja ?? cur.sentence_ja},
      sentence_romaji = ${sentence_romaji !== undefined ? sentence_romaji : cur.sentence_romaji},
      sentence_en = ${sentence_en ?? cur.sentence_en},
      notes = ${notes !== undefined ? notes : cur.notes},
      sort_order = ${sort_order ?? cur.sort_order}
    WHERE id = ${id}
  `;
  const rows = await sql`SELECT id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order FROM examples WHERE id = ${id} LIMIT 1`;
  return NextResponse.json((rows as object[])[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  await sql`DELETE FROM examples WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
