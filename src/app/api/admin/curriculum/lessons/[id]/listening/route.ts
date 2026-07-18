import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT cl.id, cl.lesson_id, cl.listening_id, cl.sort_order, p.slug, l.title, l.level
    FROM curriculum_lesson_listening cl
    JOIN listening l ON l.id = cl.listening_id
    JOIN posts p ON p.id = l.post_id
    WHERE cl.lesson_id = ${lessonId}
    ORDER BY cl.sort_order, l.title
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { listening_id, sort_order } = body;
  if (!listening_id || typeof listening_id !== "string") {
    return NextResponse.json({ error: "listening_id required" }, { status: 400 });
  }
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO curriculum_lesson_listening (lesson_id, listening_id, sort_order)
    VALUES (${lessonId}, ${listening_id}, ${sort})
    ON CONFLICT (lesson_id, listening_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id, lesson_id, listening_id, sort_order
  `;
  const row = (rows as unknown[])[0];
  return NextResponse.json(row);
}
