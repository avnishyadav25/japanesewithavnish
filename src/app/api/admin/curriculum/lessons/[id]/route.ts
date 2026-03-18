import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, submodule_id, code, title, goal, introduction, sort_order, feature_image_url, created_at, updated_at
    FROM curriculum_lessons WHERE id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; submodule_id: string; code: string; title: string; goal: string | null; introduction: string | null; sort_order: number; feature_image_url: string | null; created_at: string; updated_at: string }[])[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  try {
    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim() : undefined;
    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    const goal = body.goal !== undefined ? (typeof body.goal === "string" ? body.goal.trim() || null : null) : undefined;
    const introduction = body.introduction !== undefined ? (typeof body.introduction === "string" ? body.introduction.trim() || null : null) : undefined;
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : undefined;
    const feature_image_url = typeof body.feature_image_url === "string" ? body.feature_image_url.trim() || null : undefined;
    if (code === undefined && title === undefined && goal === undefined && introduction === undefined && sort_order === undefined && feature_image_url === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const existing = (await sql`SELECT code, title, goal, introduction, sort_order, feature_image_url FROM curriculum_lessons WHERE id = ${id} LIMIT 1`) as { code: string; title: string; goal: string | null; introduction: string | null; sort_order: number; feature_image_url: string | null }[];
    if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];
    await sql`
      UPDATE curriculum_lessons SET
        code = ${code ?? cur.code},
        title = ${title ?? cur.title},
        goal = ${goal !== undefined ? goal : cur.goal},
        introduction = ${introduction !== undefined ? introduction : cur.introduction},
        sort_order = ${sort_order ?? cur.sort_order},
        feature_image_url = ${feature_image_url !== undefined ? feature_image_url : cur.feature_image_url},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    const rows = await sql`SELECT id, submodule_id, code, title, goal, introduction, sort_order, feature_image_url, created_at, updated_at FROM curriculum_lessons WHERE id = ${id} LIMIT 1`;
    return NextResponse.json((rows as object[])[0]);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Lesson code already exists" : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  try {
    await sql`DELETE FROM curriculum_lessons WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Curriculum lesson DELETE:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
