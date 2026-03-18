import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const submoduleId = req.nextUrl.searchParams.get("submoduleId");
  if (!submoduleId) return NextResponse.json({ error: "submoduleId required" }, { status: 400 });
  try {
    const rows = await sql`
      SELECT id, submodule_id, code, title, goal, introduction, sort_order, created_at, updated_at
      FROM curriculum_lessons WHERE submodule_id = ${submoduleId} ORDER BY sort_order, code
    `;
    return NextResponse.json(rows as { id: string; submodule_id: string; code: string; title: string; goal: string | null; introduction: string | null; sort_order: number; created_at: string; updated_at: string }[]);
  } catch (e) {
    console.error("Curriculum lessons GET:", e);
    return NextResponse.json({ error: "Failed to list lessons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { submodule_id, code, title, goal, introduction, sort_order } = body;
    if (!submodule_id || typeof submodule_id !== "string" || !code || typeof code !== "string" || !title || typeof title !== "string") {
      return NextResponse.json({ error: "submodule_id, code, title required" }, { status: 400 });
    }
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const goalVal = typeof goal === "string" ? goal.trim() || null : null;
    const introVal = typeof introduction === "string" ? introduction.trim() || null : null;
    const rows = await sql`
      INSERT INTO curriculum_lessons (submodule_id, code, title, goal, introduction, sort_order)
      VALUES (${submodule_id}, ${code.trim()}, ${title.trim()}, ${goalVal}, ${introVal}, ${sort})
      RETURNING id, submodule_id, code, title, goal, introduction, sort_order, created_at, updated_at
    `;
    const row = (rows as { id: string; submodule_id: string; code: string; title: string; goal: string | null; introduction: string | null; sort_order: number; created_at: string; updated_at: string }[])[0];
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Lesson code already exists for this submodule" : "Failed to create lesson";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
