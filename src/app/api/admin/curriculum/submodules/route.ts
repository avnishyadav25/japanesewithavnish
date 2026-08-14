import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });
  try {
    const rows = await sql`
      SELECT id, module_id, code, title, sort_order, created_at, updated_at
      FROM curriculum_submodules WHERE module_id = ${moduleId} ORDER BY sort_order, code
    `;
    return NextResponse.json(rows as { id: string; module_id: string; code: string; title: string; sort_order: number; created_at: string; updated_at: string }[]);
  } catch (e) {
    console.error("Curriculum submodules GET:", e);
    return NextResponse.json({ error: "Failed to list submodules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { module_id, code, title, sort_order } = body;
    if (!module_id || typeof module_id !== "string" || !code || typeof code !== "string" || !title || typeof title !== "string") {
      return NextResponse.json({ error: "module_id, code, title required" }, { status: 400 });
    }
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const rows = await sql`
      INSERT INTO curriculum_submodules (module_id, code, title, sort_order)
      VALUES (${module_id}, ${code.trim()}, ${title.trim()}, ${sort})
      RETURNING id, module_id, code, title, sort_order, created_at, updated_at
    `;
    const row = (rows as { id: string; module_id: string; code: string; title: string; sort_order: number; created_at: string; updated_at: string }[])[0];
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Submodule code already exists for this module" : "Failed to create submodule";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
