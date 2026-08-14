import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { exam_type, level_id, module_id, score, section_scores, passed } = body;
    if (!exam_type || typeof exam_type !== "string") {
      return NextResponse.json({ error: "exam_type required" }, { status: 400 });
    }
    const levelId = level_id && typeof level_id === "string" ? level_id : null;
    const moduleId = module_id && typeof module_id === "string" ? module_id : null;
    const scoreVal = typeof score === "number" ? score : null;
    const sectionScores = section_scores && typeof section_scores === "object" && !Array.isArray(section_scores) ? JSON.stringify(section_scores) : "{}";
    const passedVal = !!passed;

    const rows = await sql`
      INSERT INTO exam_attempts (user_email, exam_type, level_id, module_id, score, section_scores, passed, completed_at)
      VALUES (${session.email}, ${exam_type.trim()}, ${levelId}, ${moduleId}, ${scoreVal}, ${sectionScores}::jsonb, ${passedVal}, NOW())
      RETURNING id, user_email, exam_type, level_id, module_id, score, passed, completed_at
    `;
    const row = (rows as { id: string; level_id: string | null; module_id: string | null; passed: boolean }[])[0];
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

    if (passedVal) {
      if (row.level_id) {
        await sql`
          INSERT INTO user_level_progress (user_email, level_id, mock_passed, mock_passed_at, updated_at)
          VALUES (${session.email}, ${row.level_id}, true, NOW(), NOW())
          ON CONFLICT (user_email, level_id) DO UPDATE SET mock_passed = true, mock_passed_at = NOW(), updated_at = NOW()
        `;
        const levelRows = await sql`SELECT code FROM curriculum_levels WHERE id = ${row.level_id} LIMIT 1` as { code: string }[];
        const levelCode = levelRows[0]?.code?.toLowerCase();
        if (levelCode) {
          const achCode = `level_${levelCode}_mock`;
          const defRows = await sql`SELECT id FROM achievement_definitions WHERE code = ${achCode} LIMIT 1` as { id: string }[];
          if (defRows[0]) {
            await sql`
              INSERT INTO user_achievements (user_email, achievement_id)
              VALUES (${session.email}, ${defRows[0].id})
              ON CONFLICT (user_email, achievement_id) DO NOTHING
            `.catch(() => {});
          }
        }
      }
      if (row.module_id) {
        await sql`
          INSERT INTO user_module_progress (user_email, module_id, review_passed, review_passed_at, updated_at)
          VALUES (${session.email}, ${row.module_id}, true, NOW(), NOW())
          ON CONFLICT (user_email, module_id) DO UPDATE SET review_passed = true, review_passed_at = NOW(), updated_at = NOW()
        `;
      }
    }

    return NextResponse.json({ success: true, attemptId: row.id });
  } catch (e) {
    console.error("Exam submit:", e);
    return NextResponse.json({ error: "Failed to submit exam" }, { status: 500 });
  }
}
