import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_TYPES = ["writing_canvas", "mcq", "fill_blank", "roleplay", "listening", "shadowing", "module_checkpoint", "level_assessment"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { pid } = await params;
  try {
    const body = await req.json();
    const existing = (await sql`
      SELECT title, description, practice_type, content_data, sort_order, estimated_minutes
      FROM curriculum_practices WHERE id = ${pid} LIMIT 1
    `) as { title: string; description: string | null; practice_type: string | null; content_data: unknown; sort_order: number; estimated_minutes: number | null }[];
    if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];

    const title = typeof body.title === "string" ? body.title.trim() : cur.title;
    const description = body.description !== undefined ? (body.description?.trim() || null) : cur.description;
    const practice_type = VALID_TYPES.includes(body.practice_type) ? body.practice_type : cur.practice_type;
    const content_data = body.content_data !== undefined ? body.content_data : cur.content_data;
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : cur.sort_order;
    const estimated_minutes = typeof body.estimated_minutes === "number" ? body.estimated_minutes : cur.estimated_minutes;

    await sql`
      UPDATE curriculum_practices SET
        title = ${title},
        description = ${description},
        practice_type = ${practice_type},
        content_data = ${content_data ? JSON.stringify(content_data) : null},
        sort_order = ${sort_order},
        estimated_minutes = ${estimated_minutes},
        updated_at = NOW()
      WHERE id = ${pid}
    `;
    const rows = await sql`
      SELECT id, lesson_id, title, description, practice_type, content_data,
             sort_order, estimated_minutes, created_at, updated_at
      FROM curriculum_practices WHERE id = ${pid} LIMIT 1
    `;
    return NextResponse.json((rows as object[])[0]);
  } catch (e) {
    console.error("Practice PATCH:", e);
    return NextResponse.json({ error: "Failed to update practice" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { pid } = await params;
  try {
    await sql`DELETE FROM curriculum_practices WHERE id = ${pid}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Practice DELETE:", e);
    return NextResponse.json({ error: "Failed to delete practice" }, { status: 500 });
  }
}
