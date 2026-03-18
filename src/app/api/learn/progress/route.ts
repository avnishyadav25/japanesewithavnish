import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized", profile: null, stats: null }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({
      profile: null,
      stats: { learnedCount: 0, dueCount: 0, rewardCount: 0, currentStreak: 0, longestStreak: 0, totalPoints: 0, pointsToday: 0 },
      curriculum: { nextLesson: null, lessonsCompleted: 0 },
      dailyRoutine: null,
    });
  }
  try {
    let profile: { email: string; recommended_level: string | null; display_name: string | null; current_streak?: number; longest_streak?: number } | null = null;
    try {
      const profileRows = await sql`
        SELECT email, recommended_level, display_name, current_streak, longest_streak
        FROM profiles WHERE email = ${session.email} LIMIT 1
      ` as { email: string; recommended_level: string | null; display_name: string | null; current_streak?: number; longest_streak?: number }[];
      profile = profileRows[0] ?? null;
    } catch {
      const profileRows = await sql`
        SELECT email, recommended_level, display_name FROM profiles WHERE email = ${session.email} LIMIT 1
      ` as { email: string; recommended_level: string | null; display_name: string | null }[];
      profile = profileRows[0] ?? null;
    }
    const [learnedRows, dueRows, rewardRows, totalPointsRows, pointsTodayRows, nextLessonRows, lessonProgressRows] = (await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM user_learning_progress WHERE user_email = ${session.email} AND status = 'learned'`,
      sql`SELECT COUNT(*)::int AS c FROM review_schedule WHERE user_email = ${session.email} AND next_review_at <= NOW()`,
      sql`SELECT COUNT(*)::int AS c FROM reward_events WHERE user_email = ${session.email}`.catch(() => []),
      sql`SELECT COALESCE(SUM(points), 0)::int AS total FROM reward_events WHERE user_email = ${session.email}`.catch(() => []),
      sql`SELECT COALESCE(SUM(points), 0)::int AS total FROM reward_events WHERE user_email = ${session.email} AND created_at::date = CURRENT_DATE`.catch(() => []),
      // Next lesson: first lesson in curriculum order not completed by this user
      sql`
        SELECT l.id, l.title, l.code AS lesson_code, sm.title AS submodule_title, m.title AS module_title, lv.code AS level_code
        FROM curriculum_lessons l
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        JOIN curriculum_modules m ON m.id = sm.module_id
        JOIN curriculum_levels lv ON lv.id = m.level_id
        WHERE NOT EXISTS (
          SELECT 1 FROM user_lesson_progress ulp WHERE ulp.user_email = ${session.email} AND ulp.lesson_id = l.id AND ulp.status = 'completed'
        )
        ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order
        LIMIT 1
      `.catch(() => []),
      sql`SELECT COUNT(*)::int AS c FROM user_lesson_progress WHERE user_email = ${session.email} AND status = 'completed'`.catch(() => []),
    ])) as { c?: number; total?: number; id?: string; title?: string; lesson_code?: string; submodule_title?: string; module_title?: string; level_code?: string }[][];
    const learnedCount = learnedRows?.[0]?.c ?? 0;
    const dueCount = dueRows?.[0]?.c ?? 0;
    const rewardCount = rewardRows?.[0]?.c ?? 0;
    const totalPoints = (totalPointsRows?.[0] as { total?: number })?.total ?? 0;
    const pointsToday = (pointsTodayRows?.[0] as { total?: number })?.total ?? 0;
    const nextLessonRow = nextLessonRows?.[0] as { id: string; title: string; lesson_code: string; submodule_title: string; module_title: string; level_code: string } | undefined;
    const lessonsCompleted = (lessonProgressRows?.[0] as { c?: number })?.c ?? 0;
    const nextLesson = nextLessonRow
      ? {
          id: nextLessonRow.id,
          title: nextLessonRow.title,
          lessonCode: nextLessonRow.lesson_code,
          submoduleTitle: nextLessonRow.submodule_title,
          moduleTitle: nextLessonRow.module_title,
          levelCode: nextLessonRow.level_code,
        }
      : null;

    const levelCode = profile?.recommended_level ?? "N5";
    let lessonsToday = 0;
    let reviewsToday = 0;
    let dailyRoutine: { baseline: { min_reading: number; min_review: number }; current: { lessonsToday: number; reviewsToday: number }; items: { label: string; current: number; required: number; done: boolean }[] } | null = null;
    try {
      const [lessonsTodayRows, reviewsTodayRows, baselineRows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS c FROM user_lesson_progress WHERE user_email = ${session.email} AND status = 'completed' AND completed_at::date = CURRENT_DATE`,
        sql`SELECT COUNT(*)::int AS c FROM reward_events WHERE user_email = ${session.email} AND reward_type = 'review_complete' AND created_at::date = CURRENT_DATE`,
        sql`SELECT min_reading, min_grammar, min_review FROM daily_routine_baseline WHERE level_code = ${levelCode} LIMIT 1`.catch(() => []),
      ]);
      lessonsToday = (lessonsTodayRows as { c: number }[])?.[0]?.c ?? 0;
      reviewsToday = (reviewsTodayRows as { c: number }[])?.[0]?.c ?? 0;
      const baseline = (baselineRows as { min_reading: number; min_grammar: number; min_review: number }[])?.[0];
      if (baseline) {
        dailyRoutine = {
          baseline: { min_reading: baseline.min_reading, min_review: baseline.min_review },
          current: { lessonsToday, reviewsToday },
          items: [
            { label: "Lessons", current: lessonsToday, required: baseline.min_reading, done: lessonsToday >= baseline.min_reading },
            { label: "Reviews", current: reviewsToday, required: baseline.min_review, done: reviewsToday >= baseline.min_review },
          ],
        };
      }
    } catch {
      dailyRoutine = null;
    }

    return NextResponse.json({
      profile: profile ? { email: profile.email, recommended_level: profile.recommended_level, display_name: profile.display_name } : null,
      stats: { learnedCount, dueCount, rewardCount, currentStreak: profile?.current_streak ?? 0, longestStreak: profile?.longest_streak ?? 0, totalPoints, pointsToday, lessonsCompleted },
      curriculum: { nextLesson, lessonsCompleted },
      dailyRoutine,
    });
  } catch (e) {
    console.error("Progress GET:", e);
    return NextResponse.json({
      profile: null,
      stats: { learnedCount: 0, dueCount: 0, rewardCount: 0, currentStreak: 0, longestStreak: 0, totalPoints: 0, pointsToday: 0 },
      curriculum: { nextLesson: null, lessonsCompleted: 0 },
      dailyRoutine: null,
    });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { slug, status, addToReview, lessonId } = body;

    // Curriculum lesson completion
    if (lessonId && typeof lessonId === "string") {
      await sql`
        INSERT INTO user_lesson_progress (user_email, lesson_id, status, completed_at, updated_at)
        VALUES (${session.email}, ${lessonId}, 'completed', NOW(), NOW())
        ON CONFLICT (user_email, lesson_id) DO UPDATE SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      `;
      // Award first_lesson achievement if this is their first completed lesson
      const countRows = await sql`
        SELECT COUNT(*)::int AS c FROM user_lesson_progress WHERE user_email = ${session.email} AND status = 'completed'
      ` as { c: number }[];
      const completedCount = countRows?.[0]?.c ?? 0;
      if (completedCount === 1) {
        const defRows = await sql`
          SELECT id, code, points FROM achievement_definitions WHERE code = 'first_lesson' LIMIT 1
        ` as { id: string; code: string; points: number }[];
        const def = defRows?.[0];
        if (def) {
          await sql`
            INSERT INTO user_achievements (user_email, achievement_id)
            VALUES (${session.email}, ${def.id})
            ON CONFLICT (user_email, achievement_id) DO NOTHING
          `;
          if (def.points && def.points > 0) {
            await sql`
              INSERT INTO reward_events (user_email, reward_type, points)
              VALUES (${session.email}, 'achievement_first_lesson', ${def.points})
            `;
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "slug or lessonId required" }, { status: 400 });
    }
    const newStatus = status === "learned" ? "learned" : "viewed";
    await sql`
      INSERT INTO user_learning_progress (user_email, content_slug, status, last_reviewed_at, updated_at)
      VALUES (${session.email}, ${slug}, ${newStatus}, NOW(), NOW())
      ON CONFLICT (user_email, content_slug) DO UPDATE SET
        status = ${newStatus},
        last_reviewed_at = NOW(),
        updated_at = NOW()
    `;
    if (addToReview) {
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 1);
      await sql`
        INSERT INTO review_schedule (user_email, item_type, item_id, next_review_at, interval_days, updated_at)
        VALUES (${session.email}, 'vocab', ${slug}, ${nextReview.toISOString()}, 1, NOW())
        ON CONFLICT (user_email, item_type, item_id) DO UPDATE SET
          next_review_at = EXCLUDED.next_review_at,
          updated_at = NOW()
      `;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Progress POST:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
