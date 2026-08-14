import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const rows = await sql`
      SELECT id, code, name, sort_order, created_at, updated_at
      FROM curriculum_levels ORDER BY sort_order, code
    `;
    return NextResponse.json(rows as { id: string; code: string; name: string; sort_order: number; created_at: string; updated_at: string }[]);
  } catch (e) {
    console.error("Curriculum levels GET:", e);
    return NextResponse.json({ error: "Failed to list levels" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { code, name, sort_order } = body;
    if (!code || typeof code !== "string" || !name || typeof name !== "string") {
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    }
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const rows = await sql`
      INSERT INTO curriculum_levels (code, name, sort_order)
      VALUES (${code.trim()}, ${name.trim()}, ${sort})
      RETURNING id, code, name, sort_order, created_at, updated_at
    `;
    const row = (rows as { id: string; code: string; name: string; sort_order: number; created_at: string; updated_at: string }[])[0];
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505" ? "Level code already exists" : "Failed to create level";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
