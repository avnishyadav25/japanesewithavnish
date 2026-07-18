import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const SECTION_TYPES = new Set(["vocabulary", "grammar", "reading", "listening"]);

/** Builder sends the section's full current state on every field edit (not a partial diff), so
 * a key's mere presence in the body means "set to this" — including explicit null to clear
 * time_limit_minutes/passage/audio_url — while an absent key leaves the column untouched. */
export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string; sectionId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { sectionId } = await params;
  const body = await req.json();

  const existingRows = await sql`SELECT * FROM practice_test_sections WHERE id = ${sectionId} LIMIT 1`;
  const existing = (existingRows as Record<string, unknown>[])[0];
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const title = "title" in body && typeof body.title === "string" && body.title.trim() ? body.title : existing.title;
  const sectionType = "section_type" in body && SECTION_TYPES.has(body.section_type) ? body.section_type : existing.section_type;
  const timeLimitMinutes = "time_limit_minutes" in body ? (typeof body.time_limit_minutes === "number" ? body.time_limit_minutes : null) : existing.time_limit_minutes;
  const passage = "passage" in body ? (typeof body.passage === "string" ? body.passage : null) : existing.passage;
  const audioUrl = "audio_url" in body ? (typeof body.audio_url === "string" ? body.audio_url : null) : existing.audio_url;
  const sortOrder = "sort_order" in body && typeof body.sort_order === "number" ? body.sort_order : existing.sort_order;

  const rows = await sql`
    UPDATE practice_test_sections SET
      title = ${title}, section_type = ${sectionType}, time_limit_minutes = ${timeLimitMinutes}::int,
      passage = ${passage}::text, audio_url = ${audioUrl}::text, sort_order = ${sortOrder}::int, updated_at = NOW()
    WHERE id = ${sectionId}
    RETURNING id, practice_test_id, title, section_type, time_limit_minutes, passage, audio_url, sort_order
  `;
  return NextResponse.json((rows as unknown[])[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string; sectionId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { sectionId } = await params;
  const result = await sql`DELETE FROM practice_test_sections WHERE id = ${sectionId} RETURNING id`;
  if (!(result as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
