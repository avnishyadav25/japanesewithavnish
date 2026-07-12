import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { validateLessonCompleteness } from "@/lib/curriculum/validateLessonCompleteness";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;

  const rows = (await sql`SELECT content_type FROM curriculum_lessons WHERE id = ${lessonId}`) as { content_type: string | null }[];
  if (!rows.length) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const checklist = await validateLessonCompleteness(lessonId, rows[0].content_type);
  return NextResponse.json(checklist);
}
