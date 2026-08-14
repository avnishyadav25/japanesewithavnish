import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const levelId = req.nextUrl.searchParams.get("levelId");
  if (!levelId) return NextResponse.json({ error: "levelId required" }, { status: 400 });
  try {
    const rows = await sql`
      SELECT id, level_id, code, title, sort_order, created_at, updated_at
      FROM curriculum_modules WHERE level_id = ${levelId} ORDER BY sort_order, code
    `;
    return NextResponse.json(rows as { id: string; level_id: string; code: string; title: string; sort_order: number; created_at: string; updated_at: string }[]);
  } catch (e) {
    console.error("Curriculum modules GET:", e);
    return NextResponse.json({ error: "Failed to list modules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { level_id, code, title, sort_order } = body;
    if (!level_id || typeof level_id !== "string" || !code || typeof code !== "string" || !title || typeof title !== "string") {
      return NextResponse.json({ error: "level_id, code, title required" }, { status: 400 });
    }
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const rows = await sql`
      INSERT INTO curriculum_modules (level_id, code, title, sort_order)
      VALUES (${level_id}, ${code.trim()}, ${title.trim()}, ${sort})
      RETURNING id, level_id, code, title, sort_order, created_at, updated_at
    `;
    const row = (rows as { id: string; level_id: string; code: string; title: string; sort_order: number; created_at: string; updated_at: string }[])[0];
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Module code already exists for this level" : "Failed to create module";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
