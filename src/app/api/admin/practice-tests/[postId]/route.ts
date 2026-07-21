import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * Full nested tree (test settings + sections + their questions) for the
 * PracticeTestBuilder admin UI, in one round trip. Test-level scalar settings
 * (duration/passing score/instructions/pdf_url) are saved through the regular
 * PUT /api/admin/learning-content/[type]/[slug] (sidecar payload) — this route
 * is read-only for the test row, read/write for sections+questions below it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { postId } = await params;

  const testRows = await sql`
    SELECT id, post_id, duration_minutes, passing_score_percent, instructions, pdf_url, test_variant, attempt_policy
    FROM practice_tests WHERE post_id = ${postId} LIMIT 1
  `;
  const test = (testRows as Record<string, unknown>[])[0];
  if (!test) return NextResponse.json({ test: null, sections: [] });

  const sectionRows = await sql`
    SELECT id, practice_test_id, title, section_type, time_limit_minutes, passage, audio_url, sort_order
    FROM practice_test_sections WHERE practice_test_id = ${test.id} ORDER BY sort_order, created_at
  `;
  const sectionIds = (sectionRows as { id: string }[]).map((s) => s.id);

  const questionRows = sectionIds.length
    ? await sql`
        SELECT id, section_id, question_text, item_type, options, correct_index, explanation, audio_url, sort_order
        FROM practice_test_questions WHERE section_id = ANY(${sectionIds}) ORDER BY sort_order, created_at
      `
    : [];

  const questionsBySection = new Map<string, unknown[]>();
  for (const q of questionRows as { section_id: string }[]) {
    const list = questionsBySection.get(q.section_id) ?? [];
    list.push(q);
    questionsBySection.set(q.section_id, list);
  }

  const sections = (sectionRows as { id: string }[]).map((s) => ({
    ...s,
    questions: questionsBySection.get(s.id) ?? [],
  }));

  return NextResponse.json({ test, sections });
}
