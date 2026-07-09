import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hasActivePremium, getISTDateKey, getISTNextMidnight } from "@/lib/auth/access";

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
  description: string | null;
  access_type: string;
  content_type: string | null;
  slug: string;
};

type PracticeRow = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  practice_type: string | null;
  sort_order: number;
  estimated_minutes: number | null;
};

export type PathStep =
  | { type: "level"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | { type: "module"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | { type: "submodule"; id: string; code: string; title: string; levelCode: string; sort_key: number }
  | {
      type: "lesson";
      id: string;
      slug: string;
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
      SELECT id, submodule_id, code, title, sort_order, estimated_minutes,
             feature_image_url, description, access_type, content_type, slug
      FROM curriculum_lessons ORDER BY sort_order, code
    `) as LessonRow[];

    const practiceRows = (await sql`
      SELECT id, lesson_id, title, description, practice_type, sort_order, estimated_minutes
      FROM curriculum_practices
      ORDER BY lesson_id, sort_order
    `) as PracticeRow[];
    const practicesByLessonId: Record<string, PracticeRow[]> = {};
    for (const p of practiceRows) {
      if (!practicesByLessonId[p.lesson_id]) practicesByLessonId[p.lesson_id] = [];
      practicesByLessonId[p.lesson_id].push(p);
    }

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
    let isPremium = false;
    let lessonsConsumed = 0;
    let lessonsAllowed = 2;
    const resetAt = getISTNextMidnight().toISOString();

    if (session?.email) {
      const profileRows = (await sql`
        SELECT recommended_level, current_level, premium_until, is_lifetime FROM profiles WHERE email = ${session.email} LIMIT 1
      `) as { recommended_level: string | null; current_level: string | null; premium_until: string | null; is_lifetime: boolean }[];
      const p = profileRows[0];
      if (p) {
        if (p.current_level) currentLevelCode = p.current_level;
        else if (p.recommended_level) currentLevelCode = p.recommended_level;
        isPremium = hasActivePremium(p);
      }

      if (!isPremium) {
        const dateKey = getISTDateKey();
        const dailyRows = await sql`
          SELECT lessons_consumed, lessons_allowed FROM daily_lesson_access
          WHERE user_email = ${session.email} AND date_key = ${dateKey} LIMIT 1
        ` as { lessons_consumed: number; lessons_allowed: number }[];
        if (dailyRows[0]) {
          lessonsConsumed = dailyRows[0].lessons_consumed;
          lessonsAllowed = dailyRows[0].lessons_allowed;
        }
      }
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
                  description: l.description ?? null,
                  access_type: l.access_type ?? "premium",
                  content_type: l.content_type ?? null,
                  sort_order: l.sort_order,
                  slug: l.slug,
                  ...(l.estimated_minutes != null && { estimated_minutes: l.estimated_minutes }),
                  ...(l.feature_image_url && { feature_image_url: l.feature_image_url }),
                  exercises: exercisesByLessonId[l.id] ?? [],
                  practices: (practicesByLessonId[l.id] ?? []).map((p) => ({
                    id: p.id,
                    title: p.title,
                    description: p.description ?? null,
                    practice_type: p.practice_type ?? null,
                    sort_order: p.sort_order,
                    ...(p.estimated_minutes != null && { estimated_minutes: p.estimated_minutes }),
                  })),
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
                slug: l.slug,
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

    const isLocalTest =
      process.env.NODE_ENV !== "production" && process.env.LOCALTEST === "true";
    const isLoggedIn = isLocalTest || !!session?.email;

    const payload = pathOnly
      ? {
          levels: tree,
          pathSteps,
          totalEstimatedMinutes,
          pathProgressPercent,
          currentLevelCode,
          isLoggedIn,
          completedLessonIds: isLoggedIn ? (completedLessonIds || []) : undefined,
          ...(isLoggedIn && { dueReviewsCount, advanceBlocked, advanceBlockReason, isPremium, lessonsConsumed, lessonsAllowed, resetAt }),
        }
      : {
          levels: tree,
          pathSteps,
          totalEstimatedMinutes,
          pathProgressPercent,
          currentLevelCode,
          isLoggedIn,
          ...(isLoggedIn && { dueReviewsCount, advanceBlocked, advanceBlockReason, isPremium, lessonsConsumed, lessonsAllowed, resetAt }),
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
