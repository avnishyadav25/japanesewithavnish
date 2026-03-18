import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT id, lesson_id, content_slug, post_id, content_role, sort_order, title
    FROM curriculum_lesson_content WHERE lesson_id = ${lessonId} ORDER BY sort_order, content_slug
  `;
  return NextResponse.json(rows as { id: string; lesson_id: string; content_slug: string; post_id: string | null; content_role: string; sort_order: number; title: string | null }[]);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { content_slug, content_role, sort_order, title } = body;
  if (!content_slug || typeof content_slug !== "string") {
    return NextResponse.json({ error: "content_slug required" }, { status: 400 });
  }
  const role = typeof content_role === "string" ? content_role.trim() || "main" : "main";
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const titleVal = typeof title === "string" ? title.trim() || null : null;
  const rows = await sql`
    INSERT INTO curriculum_lesson_content (lesson_id, content_slug, content_role, sort_order, title)
    VALUES (${lessonId}, ${content_slug.trim()}, ${role}, ${sort}, ${titleVal})
    RETURNING id, lesson_id, content_slug, post_id, content_role, sort_order, title
  `;
  const row = (rows as { id: string; lesson_id: string; content_slug: string; post_id: string | null; content_role: string; sort_order: number; title: string | null }[])[0];
  return NextResponse.json(row);
}
