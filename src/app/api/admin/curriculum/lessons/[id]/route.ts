import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_ACCESS = ["free", "premium"];
const VALID_ACCESS_POLICIES = ["always_free", "daily_free_eligible", "premium_only", "trial_only", "admin_granted"];
const VALID_CONTENT_TYPES = ["grammar", "vocabulary", "kanji", "kana", "reading", "listening", "writing", "conversation", "review", "mock_test", "mixed", "orientation", "pronunciation", "speaking", "culture", "strategy"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, submodule_id, code, title, goal, introduction,
           description, access_type, access_policy, premium_bypass, content_type, estimated_minutes,
           sort_order, feature_image_url, created_at, updated_at
    FROM curriculum_lessons WHERE id = ${id} LIMIT 1
  `;
  const row = (rows as object[])[0];
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
    const existing = (await sql`
      SELECT code, title, goal, introduction, description, access_type, access_policy, premium_bypass, content_type,
             estimated_minutes, sort_order, feature_image_url
      FROM curriculum_lessons WHERE id = ${id} LIMIT 1
    `) as {
      code: string; title: string; goal: string | null; introduction: string | null;
      description: string | null; access_type: string; access_policy: string; premium_bypass: boolean; content_type: string | null;
      estimated_minutes: number | null; sort_order: number; feature_image_url: string | null;
    }[];
    if (!existing?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];

    const code = typeof body.code === "string" ? body.code.trim() : cur.code;
    const title = typeof body.title === "string" ? body.title.trim() : cur.title;
    const goal = body.goal !== undefined ? (body.goal?.trim() || null) : cur.goal;
    const introduction = body.introduction !== undefined ? (body.introduction?.trim() || null) : cur.introduction;
    const description = body.description !== undefined ? (body.description?.trim() || null) : cur.description;
    const access_type = VALID_ACCESS.includes(body.access_type) ? body.access_type : cur.access_type;
    const access_policy = VALID_ACCESS_POLICIES.includes(body.access_policy) ? body.access_policy : cur.access_policy;
    const premium_bypass = typeof body.premium_bypass === "boolean" ? body.premium_bypass : cur.premium_bypass;
    const content_type = VALID_CONTENT_TYPES.includes(body.content_type) ? body.content_type : cur.content_type;
    const estimated_minutes = typeof body.estimated_minutes === "number" ? body.estimated_minutes : cur.estimated_minutes;
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : cur.sort_order;
    const feature_image_url = body.feature_image_url !== undefined ? (body.feature_image_url?.trim() || null) : cur.feature_image_url;

    await sql`
      UPDATE curriculum_lessons SET
        code = ${code},
        title = ${title},
        goal = ${goal},
        introduction = ${introduction},
        description = ${description},
        access_type = ${access_type},
        access_policy = ${access_policy},
        premium_bypass = ${premium_bypass},
        content_type = ${content_type},
        estimated_minutes = ${estimated_minutes},
        sort_order = ${sort_order},
        feature_image_url = ${feature_image_url},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    const rows = await sql`
      SELECT id, submodule_id, code, title, goal, introduction,
             description, access_type, access_policy, premium_bypass, content_type, estimated_minutes,
             sort_order, feature_image_url, created_at, updated_at
      FROM curriculum_lessons WHERE id = ${id} LIMIT 1
    `;
    return NextResponse.json((rows as object[])[0]);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
      ? "Lesson code already exists"
      : "Failed to update";
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
