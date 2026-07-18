import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT cl.id, cl.lesson_id, cl.reading_id, cl.sort_order, p.slug, r.title, r.level
    FROM curriculum_lesson_reading cl
    JOIN reading r ON r.id = cl.reading_id
    JOIN posts p ON p.id = r.post_id
    WHERE cl.lesson_id = ${lessonId}
    ORDER BY cl.sort_order, r.title
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { reading_id, sort_order } = body;
  if (!reading_id || typeof reading_id !== "string") {
    return NextResponse.json({ error: "reading_id required" }, { status: 400 });
  }
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO curriculum_lesson_reading (lesson_id, reading_id, sort_order)
    VALUES (${lessonId}, ${reading_id}, ${sort})
    ON CONFLICT (lesson_id, reading_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id, lesson_id, reading_id, sort_order
  `;
  const row = (rows as unknown[])[0];
  return NextResponse.json(row);
}
