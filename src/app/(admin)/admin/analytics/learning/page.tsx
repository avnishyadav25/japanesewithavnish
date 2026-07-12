import { sql } from "@/lib/db";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

type TopLesson = { title: string; level_code: string; completions: number };
type LevelProgress = { level_code: string; lessons: number; completed: number };
type EventRow = { content_id: string; views: number; avg_seconds: number | null };

async function safeQuery<T>(query: PromiseLike<unknown>): Promise<T | null> {
  try {
    return (await query) as T;
  } catch (error) {
    console.error("Admin learning analytics query:", error);
    return null;
  }
}

export default async function AdminLearningAnalyticsPage() {
  let metricRows: { completed_30d: number; active_30d: number; active_7d: number } | null = null;
  let topLessons: TopLesson[] = [];
  let levelProgress: LevelProgress[] = [];
  let topContent: EventRow[] = [];

  if (sql) {
    const metrics = await safeQuery<{ completed_30d: number; active_30d: number; active_7d: number }[]>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days')::int AS completed_30d,
        COUNT(DISTINCT user_email) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 days')::int AS active_30d,
        COUNT(DISTINCT user_email) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int AS active_7d
      FROM user_lesson_progress
    `);
    const top = await safeQuery<TopLesson[]>(sql`
      SELECT l.title, lv.code AS level_code, COUNT(*)::int AS completions
      FROM user_lesson_progress ulp
      JOIN curriculum_lessons l ON l.id = ulp.lesson_id
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      JOIN curriculum_levels lv ON lv.id = m.level_id
      WHERE ulp.status = 'completed'
      GROUP BY l.title, lv.code
      ORDER BY completions DESC
      LIMIT 20
    `);
    const progress = await safeQuery<LevelProgress[]>(sql`
      SELECT lv.code AS level_code, COUNT(DISTINCT l.id)::int AS lessons, COUNT(ulp.id)::int AS completed
      FROM curriculum_levels lv
      JOIN curriculum_modules m ON m.level_id = lv.id
      JOIN curriculum_submodules sm ON sm.module_id = m.id
      JOIN curriculum_lessons l ON l.submodule_id = sm.id
      LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id = l.id AND ulp.status = 'completed'
      GROUP BY lv.code, lv.sort_order
      ORDER BY lv.sort_order
    `);
    const content = await safeQuery<EventRow[]>(sql`
      SELECT content_id, COUNT(*) FILTER (WHERE event_type = 'view')::int AS views,
        ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
      FROM content_events
      WHERE content_type IN ('blog', 'page')
      GROUP BY content_id
      ORDER BY views DESC
      LIMIT 20
    `);

    metricRows = metrics?.[0] ?? null;
    topLessons = top ?? [];
    levelProgress = progress ?? [];
    topContent = content ?? [];
  }

  return (
    <div>
      <AdminPageHeader
        title="Learning Analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Analytics", href: "/admin/analytics" }, { label: "Learning" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Completed lessons 30d</p><p className="font-heading text-3xl font-bold">{Number(metricRows?.completed_30d ?? 0)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Active learners 7d</p><p className="font-heading text-3xl font-bold">{Number(metricRows?.active_7d ?? 0)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Active learners 30d</p><p className="font-heading text-3xl font-bold">{Number(metricRows?.active_30d ?? 0)}</p></AdminCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Progress By JLPT Level</h2>
          {levelProgress.length ? (
            <AdminTable headers={["Level", "Completions", "Lesson count", "Completion events / lesson"]}>
              {levelProgress.map((row) => (
                <tr key={row.level_code} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-semibold">{row.level_code}</td>
                  <td className="py-2 px-2">{Number(row.completed)}</td>
                  <td className="py-2 px-2">{Number(row.lessons)}</td>
                  <td className="py-2 px-2">{Number(row.lessons) ? Math.round((Number(row.completed) / Number(row.lessons)) * 10) / 10 : 0}</td>
                </tr>
              ))}
            </AdminTable>
          ) : <AdminEmptyState message="No level progress yet." />}
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Top Completed Lessons</h2>
          {topLessons.length ? (
            <AdminTable headers={["Lesson", "Level", "Completions"]}>
              {topLessons.map((lesson) => (
                <tr key={`${lesson.level_code}-${lesson.title}`} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-medium">{lesson.title}</td>
                  <td className="py-2 px-2">{lesson.level_code}</td>
                  <td className="py-2 px-2">{Number(lesson.completions)}</td>
                </tr>
              ))}
            </AdminTable>
          ) : <AdminEmptyState message="No completed lessons yet." />}
        </AdminCard>

        <AdminCard className="xl:col-span-2">
          <h2 className="font-heading text-lg font-semibold mb-4">Top Viewed Learning Pages</h2>
          {topContent.length ? (
            <AdminTable headers={["Content", "Views", "Avg duration"]}>
              {topContent.map((row) => (
                <tr key={row.content_id} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-mono text-xs">{row.content_id}</td>
                  <td className="py-2 px-2">{Number(row.views)}</td>
                  <td className="py-2 px-2">{row.avg_seconds ? `${row.avg_seconds}s` : "-"}</td>
                </tr>
              ))}
            </AdminTable>
          ) : <AdminEmptyState message="No page events yet." />}
        </AdminCard>
      </div>
    </div>
  );
}
