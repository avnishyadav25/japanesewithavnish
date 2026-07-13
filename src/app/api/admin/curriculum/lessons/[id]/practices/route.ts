import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_TYPES = ["writing_canvas", "mcq", "fill_blank", "roleplay", "listening", "shadowing", "module_checkpoint", "level_assessment"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, lesson_id, title, description, practice_type, content_data,
           sort_order, estimated_minutes, created_at, updated_at
    FROM curriculum_practices
    WHERE lesson_id = ${id}
    ORDER BY sort_order, created_at
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  try {
    const body = await req.json();
    const { title, description, practice_type, content_data, sort_order, estimated_minutes } = body;
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const typeVal = VALID_TYPES.includes(practice_type) ? practice_type : null;
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const rows = await sql`
      INSERT INTO curriculum_practices
        (lesson_id, title, description, practice_type, content_data, sort_order, estimated_minutes)
      VALUES (
        ${lessonId}, ${title.trim()}, ${description?.trim() || null},
        ${typeVal}, ${content_data ? JSON.stringify(content_data) : null},
        ${sort}, ${estimated_minutes ?? null}
      )
      RETURNING id, lesson_id, title, description, practice_type, content_data,
                sort_order, estimated_minutes, created_at, updated_at
    `;
    return NextResponse.json((rows as object[])[0]);
  } catch (e) {
    console.error("Practice POST:", e);
    return NextResponse.json({ error: "Failed to create practice" }, { status: 500 });
  }
}
