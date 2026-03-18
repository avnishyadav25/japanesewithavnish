import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** GET /api/learn/analytics — accuracy and latency (last 30 days); weak modules from drill data. */
export async function GET() {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ accuracyRate: null, averageResponseTimeMs: null, totalResponses: 0, byModule: [] });
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const rows = await sql`
      SELECT correct, response_time_ms
      FROM user_response_log
      WHERE user_email = ${session.email} AND created_at >= ${since.toISOString()}
    ` as { correct: boolean; response_time_ms: number | null }[];
    const total = rows.length;
    const correctCount = rows.filter((r) => r.correct).length;
    const withTime = rows.filter((r) => r.response_time_ms != null);
    const avgMs = withTime.length > 0 ? Math.round(withTime.reduce((s, r) => s + (r.response_time_ms ?? 0), 0) / withTime.length) : null;
    const byModuleRows = (await sql`
      SELECT m.id AS module_id, m.title AS module_title,
             COUNT(*)::int AS total,
             SUM(CASE WHEN gdr.correct THEN 1 ELSE 0 END)::int AS correct_count
      FROM grammar_drill_responses gdr
      JOIN grammar_drill_items gdi ON gdi.id = gdr.drill_id
      JOIN curriculum_lessons l ON l.id = gdi.lesson_id
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      WHERE gdr.user_email = ${session.email}
      GROUP BY m.id, m.title
      HAVING COUNT(*) >= 3
      ORDER BY (SUM(CASE WHEN gdr.correct THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) ASC
      LIMIT 5
    `) as { module_id: string; module_title: string; total: number; correct_count: number }[];
    const byModule = Array.isArray(byModuleRows) ? byModuleRows.map((r) => ({
      moduleId: r.module_id,
      moduleTitle: r.module_title,
      total: r.total,
      correctCount: r.correct_count,
      accuracyRate: r.total > 0 ? Math.round((r.correct_count / r.total) * 100) : 0,
    })) : [];
    return NextResponse.json({
      accuracyRate: total > 0 ? Math.round((correctCount / total) * 100) : null,
      averageResponseTimeMs: avgMs,
      totalResponses: total,
      byModule,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ accuracyRate: null, averageResponseTimeMs: null, totalResponses: 0, byModule: [] });
  }
}
