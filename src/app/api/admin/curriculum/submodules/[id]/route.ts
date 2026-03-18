import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, module_id, code, title, sort_order, summary, description, feature_image_url, created_at, updated_at FROM curriculum_submodules WHERE id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; module_id: string; code: string; title: string; sort_order: number; summary: string | null; description: string | null; feature_image_url: string | null; created_at: string; updated_at: string }[])[0];
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
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : undefined;
    const summary = typeof body.summary === "string" ? body.summary.trim() || null : undefined;
    const description = typeof body.description === "string" ? body.description.trim() || null : undefined;
    const feature_image_url = typeof body.feature_image_url === "string" ? body.feature_image_url.trim() || null : undefined;
    if (code === undefined && title === undefined && sort_order === undefined && summary === undefined && description === undefined && feature_image_url === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const existing = (await sql`SELECT code, title, sort_order, summary, description, feature_image_url FROM curriculum_submodules WHERE id = ${id} LIMIT 1`) as { code: string; title: string; sort_order: number; summary: string | null; description: string | null; feature_image_url: string | null }[];
    if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];
    await sql`
      UPDATE curriculum_submodules SET
        code = ${code ?? cur.code},
        title = ${title ?? cur.title},
        sort_order = ${sort_order ?? cur.sort_order},
        summary = ${summary !== undefined ? summary : cur.summary},
        description = ${description !== undefined ? description : cur.description},
        feature_image_url = ${feature_image_url !== undefined ? feature_image_url : cur.feature_image_url},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    const rows = await sql`SELECT id, module_id, code, title, sort_order, summary, description, feature_image_url, created_at, updated_at FROM curriculum_submodules WHERE id = ${id} LIMIT 1`;
    return NextResponse.json((rows as object[])[0]);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Submodule code already exists" : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  try {
    await sql`DELETE FROM curriculum_submodules WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Curriculum submodule DELETE:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
