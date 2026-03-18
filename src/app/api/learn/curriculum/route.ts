import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

type LevelRow = { id: string; code: string; name: string; sort_order: number; feature_image_url: string | null };
type ModuleRow = { id: string; level_id: string; code: string; title: string; sort_order: number; feature_image_url: string | null };
type SubmoduleRow = { id: string; module_id: string; code: string; title: string; sort_order: number; feature_image_url: string | null };
type LessonRow = {
  id: string;
  submodule_id: string;
  code: string;
  title: string;
  sort_order: number;
  estimated_minutes: number | null;
  feature_image_url: string | null;
};

export type PathStep =
  | { type: "level"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | { type: "module"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | { type: "submodule"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | {
      type: "lesson";
      id: string;
      code: string;
      title: string;
      levelCode: string;
      sort_key: number;
      estimated_minutes?: number;
      completed?: boolean;
    };

/** Public: full curriculum tree + optional flat path (pathSteps, progress, totalEstimatedMinutes). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pathOnly = url.searchParams.get("path") === "1";

  if (!sql) {
    return NextResponse.json(
      pathOnly ? { levels: [], pathSteps: [], totalEstimatedMinutes: 0, pathProgressPercent: 0, completedLessonIds: [] }
        : { levels: [] }
    );
  }
  try {
    const session = await getSession();
    const levels = (await sql`
      SELECT id, code, name, sort_order, feature_image_url FROM curriculum_levels ORDER BY sort_order, code
    `) as LevelRow[];
    const modules = (await sql`
      SELECT id, level_id, code, title, sort_order, feature_image_url FROM curriculum_modules ORDER BY sort_order, code
    `) as ModuleRow[];
    const submodules = (await sql`
      SELECT id, module_id, code, title, sort_order, feature_image_url FROM curriculum_submodules ORDER BY sort_order, code
    `) as SubmoduleRow[];
    const lessons = (await sql`
      SELECT id, submodule_id, code, title, sort_order, estimated_minutes, feature_image_url FROM curriculum_lessons ORDER BY sort_order, code
    `) as LessonRow[];

    const lessonContent = (await sql`
      SELECT lesson_id, id, content_slug, post_id, content_role, sort_order, title
      FROM curriculum_lesson_content
      WHERE content_role = 'exercise'
      ORDER BY lesson_id, sort_order, content_slug
    `) as { lesson_id: string; id: string; content_slug: string; post_id: string | null; content_role: string; sort_order: number; title: string | null }[];
    const exercisesByLessonId: Record<string, { id: string; content_slug: string; post_id: string | null; sort_order: number; title?: string | null }[]> = {};
    for (const row of lessonContent) {
      if (!exercisesByLessonId[row.lesson_id]) exercisesByLessonId[row.lesson_id] = [];
      exercisesByLessonId[row.lesson_id].push({
        id: row.id,
        content_slug: row.content_slug,
        post_id: row.post_id,
        sort_order: row.sort_order,
        title: row.title ?? undefined,
      });
    }

    let currentLevelCode: string = "N5";
    if (session?.email) {
      const profileRows = (await sql`
        SELECT recommended_level, current_level FROM profiles WHERE email = ${session.email} LIMIT 1
      `) as { recommended_level: string | null; current_level: string | null }[];
      const p = profileRows[0];
      if (p?.current_level) currentLevelCode = p.current_level;
      else if (p?.recommended_level) currentLevelCode = p.recommended_level;
    }

    let completedLessonIds: string[] = [];
    if (session?.email) {
      const rows = (await sql`
        SELECT lesson_id FROM user_lesson_progress WHERE user_email = ${session.email} AND status = 'completed'
      `) as { lesson_id: string }[];
      completedLessonIds = rows.map((r) => r.lesson_id);
    }

    const tree = levels.map((lv) => ({
      id: lv.id,
      code: lv.code,
      name: lv.name,
      sort_order: lv.sort_order,
      ...(lv.feature_image_url && { feature_image_url: lv.feature_image_url }),
      modules: modules
        .filter((m) => m.level_id === lv.id)
        .map((m) => ({
          id: m.id,
          code: m.code,
          title: m.title,
          sort_order: m.sort_order,
          ...(m.feature_image_url && { feature_image_url: m.feature_image_url }),
          submodules: submodules
            .filter((s) => s.module_id === m.id)
            .map((s) => ({
              id: s.id,
              code: s.code,
              title: s.title,
              sort_order: s.sort_order,
              ...(s.feature_image_url && { feature_image_url: s.feature_image_url }),
              lessons: lessons
                .filter((l) => l.submodule_id === s.id)
                .map((l) => ({
                  id: l.id,
                  code: l.code,
                  title: l.title,
                  sort_order: l.sort_order,
                  ...(l.estimated_minutes != null && { estimated_minutes: l.estimated_minutes }),
                  ...(l.feature_image_url && { feature_image_url: l.feature_image_url }),
                  exercises: exercisesByLessonId[l.id] ?? [],
                })),
            })),
        })),
    }));

    const pathSteps: PathStep[] = [];
    let totalEstimatedMinutes = 0;
    let pathProgressPercent = 0;
    const totalLessons = lessons.length;

    if (pathOnly || totalLessons > 0) {
      let sortKey = 0;
      for (const lv of levels) {
        pathSteps.push({
          type: "level",
          id: lv.id,
          code: lv.code,
          title: lv.name,
          levelCode: lv.code,
          sort_key: sortKey++,
        });
        const levelModules = modules.filter((m) => m.level_id === lv.id);
        for (const m of levelModules) {
          pathSteps.push({
            type: "module",
            id: m.id,
            code: m.code,
            title: m.title,
            levelCode: lv.code,
            sort_key: sortKey++,
          });
          const modSubs = submodules.filter((s) => s.module_id === m.id);
          for (const s of modSubs) {
            pathSteps.push({
              type: "submodule",
              id: s.id,
              code: s.code,
              title: s.title,
              levelCode: lv.code,
              sort_key: sortKey++,
            });
            const subLessons = lessons.filter((l) => l.submodule_id === s.id);
            for (const l of subLessons) {
              if (l.estimated_minutes != null) totalEstimatedMinutes += l.estimated_minutes;
              pathSteps.push({
                type: "lesson",
                id: l.id,
                code: l.code,
                title: l.title,
                levelCode: lv.code,
                sort_key: sortKey++,
                ...(l.estimated_minutes != null && { estimated_minutes: l.estimated_minutes }),
                ...(completedLessonIds.length > 0 && { completed: completedLessonIds.includes(l.id) }),
              });
            }
          }
        }
      }
      if (totalLessons > 0 && completedLessonIds.length > 0) {
        pathProgressPercent = Math.round((completedLessonIds.length / totalLessons) * 100);
      }
    }

    let advanceBlocked: boolean | undefined;
    let advanceBlockReason: string | null | undefined;
    let dueReviewsCount: number | undefined;
    if (session?.email) {
      try {
        const dueRows = (await sql`
          SELECT COUNT(*)::int AS c FROM review_schedule WHERE user_email = ${session.email} AND next_review_at <= NOW()
        `) as { c: number }[];
        dueReviewsCount = dueRows[0]?.c ?? 0;
        const nextLessonStep = pathSteps.find((s) => s.type === "lesson" && !(s as { completed?: boolean }).completed) as { type: "lesson"; id: string } | undefined;
        const nextLessonId = nextLessonStep?.id;
        if (nextLessonId) {
          const unlockRows = (await sql`
            SELECT allowed, reason FROM can_unlock_lesson(${session.email}, ${nextLessonId}::uuid)
          `) as { allowed: boolean; reason: string | null }[];
          const row = unlockRows[0];
          if (row) {
            advanceBlocked = !row.allowed;
            advanceBlockReason = row.reason ?? null;
          }
        }
      } catch {
        advanceBlocked = false;
        advanceBlockReason = null;
      }
    }

    const payload = pathOnly
      ? {
          levels: tree,
          pathSteps,
          totalEstimatedMinutes,
          pathProgressPercent,
          currentLevelCode,
          completedLessonIds: session?.email ? completedLessonIds : undefined,
          ...(session?.email && { dueReviewsCount, advanceBlocked, advanceBlockReason }),
        }
      : {
          levels: tree,
          pathSteps,
          totalEstimatedMinutes,
          pathProgressPercent,
          currentLevelCode,
          ...(session?.email && { dueReviewsCount, advanceBlocked, advanceBlockReason }),
        };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
    return res;
  } catch (e) {
    console.error("Curriculum GET:", e);
    return NextResponse.json({
      levels: [],
      pathSteps: [],
      totalEstimatedMinutes: 0,
      pathProgressPercent: 0,
    });
  }
}
