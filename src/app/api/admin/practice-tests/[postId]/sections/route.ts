import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const SECTION_TYPES = new Set(["vocabulary", "grammar", "reading", "listening"]);

export async function POST(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { postId } = await params;
  const body = await req.json();

  const sectionType = SECTION_TYPES.has(body.section_type) ? body.section_type : "vocabulary";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New section";

  const testRows = await sql`SELECT id FROM practice_tests WHERE post_id = ${postId} LIMIT 1`;
  const test = (testRows as { id: string }[])[0];
  if (!test) return NextResponse.json({ error: "Save the test once before adding sections" }, { status: 400 });

  const maxSortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max FROM practice_test_sections WHERE practice_test_id = ${test.id}`;
  const nextSort = ((maxSortRows as { max: number }[])[0]?.max ?? 0) + 10;

  const rows = await sql`
    INSERT INTO practice_test_sections (practice_test_id, title, section_type, sort_order)
    VALUES (${test.id}, ${title}, ${sectionType}, ${nextSort})
    RETURNING id, practice_test_id, title, section_type, time_limit_minutes, passage, audio_url, sort_order
  `;
  return NextResponse.json({ ...(rows as unknown[])[0] as object, questions: [] });
}
