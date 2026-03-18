import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; contentId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { contentId } = await params;
  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() || null : undefined;
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : undefined;
    if (title === undefined && sort_order === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const existing = (await sql`SELECT title, sort_order FROM curriculum_lesson_content WHERE id = ${contentId} LIMIT 1`) as { title: string | null; sort_order: number }[];
    if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];
    const newTitle = title !== undefined ? title : cur.title;
    const newSort = sort_order !== undefined ? sort_order : cur.sort_order;
    await sql`
      UPDATE curriculum_lesson_content SET title = ${newTitle}, sort_order = ${newSort}, updated_at = NOW() WHERE id = ${contentId}
    `;
    const rows = await sql`SELECT id, lesson_id, content_slug, post_id, content_role, sort_order, title FROM curriculum_lesson_content WHERE id = ${contentId} LIMIT 1`;
    return NextResponse.json((rows as object[])[0]);
  } catch (e) {
    console.error("Lesson content PATCH:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; contentId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { contentId } = await params;
  await sql`DELETE FROM curriculum_lesson_content WHERE id = ${contentId}`;
  return NextResponse.json({ success: true });
}
