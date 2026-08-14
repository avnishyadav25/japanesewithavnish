import { sql } from "@/lib/db";

export interface UserProfile {
  email: string;
  premium_until: string | Date | null;
  is_lifetime: boolean;
  target_level: string | null;
}

export function hasActivePremium(profile: { premium_until: string | Date | null; is_lifetime: boolean } | null): boolean {
  if (!profile) return false;
  if (profile.is_lifetime) return true;
  if (!profile.premium_until) return false;
  return new Date(profile.premium_until) > new Date();
}

/** Get India Standard Time (IST) date key (YYYY-MM-DD) */
export function getISTDateKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

/** Compute next midnight IST in UTC time */
export function getISTNextMidnight(date = new Date()): Date {

  // Construct local midnight in India
  const istTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const midnightIST = new Date(istTime);
  midnightIST.setDate(istTime.getDate() + 1);
  midnightIST.setHours(0, 0, 0, 0);

  // Convert back to UTC using time difference
  const offsetDiff = istTime.getTime() - date.getTime();
  return new Date(midnightIST.getTime() - offsetDiff);
}

/** IST-midnight day boundary as a UTC instant, for "already accessed today" checks.
 * Previously these checks used UTC midnight while the daily quota counter used IST midnight
 * (getISTDateKey) — a real mismatch that could under/over-count near the day boundary. */
function getISTDayStartUTC(date = new Date()): string {
  const dateKey = getISTDateKey(date);
  return new Date(`${dateKey}T00:00:00.000+05:30`).toISOString();
}

/** Reads the admin-configurable daily free-lesson quota from site_settings.
 * Previously this setting was saved by the admin UI but never actually read — the limit was
 * hardcoded to 2 everywhere. */
async function getFreeDailyLimit(): Promise<number> {
  if (!sql) return 2;
  try {
    const rows = await sql`SELECT value FROM site_settings WHERE key = 'free_daily_limit' LIMIT 1` as { value: unknown }[];
    const n = Number(rows[0]?.value);
    return Number.isFinite(n) && n > 0 ? n : 2;
  } catch {
    return 2;
  }
}

export type AccessPolicy = "always_free" | "daily_free_eligible" | "premium_only" | "trial_only" | "admin_granted";

export type AccessCheckResult =
  | { allowed: true; reason: "premium" | "free_daily" | "completed" | "always_free" | "admin_override" }
  | { allowed: false; reason: "sequential_lock" | "daily_limit_reached" | "premium_required"; resetAt: string };

/**
 * Validates if the user is allowed to access a specific lesson.
 */
export async function canAccessLesson(
  email: string,
  lessonId: string
): Promise<AccessCheckResult> {
  if (!sql) {
    return { allowed: true, reason: "free_daily" };
  }

  // 1. Fetch user profile
  const profileRows = await sql`
    SELECT email, premium_until, is_lifetime, target_level
    FROM profiles WHERE email = ${email} LIMIT 1
  ` as UserProfile[];
  const profile = profileRows[0];
  if (!profile) {
    return { allowed: false, reason: "sequential_lock", resetAt: new Date().toISOString() };
  }

  // 2. Fetch the target lesson's access policy
  const lessonRows = await sql`
    SELECT access_policy, premium_bypass FROM curriculum_lessons WHERE id = ${lessonId} LIMIT 1
  ` as { access_policy: AccessPolicy; premium_bypass: boolean }[];
  const lesson = lessonRows[0];

  // 3. Explicit admin override always wins
  if (lesson?.premium_bypass) {
    return { allowed: true, reason: "admin_override" };
  }

  // 4. always_free lessons never consume a daily slot and are always reachable
  if (lesson?.access_policy === "always_free") {
    return { allowed: true, reason: "always_free" };
  }

  // 5. If Premium/Lifetime, full unlimited access
  if (hasActivePremium(profile)) {
    return { allowed: true, reason: "premium" };
  }

  // 6. Lessons explicitly gated away from the free-daily path require an active premium
  //    grant. Today there is a single premium tier (premium_until/is_lifetime) — trial and
  //    admin-granted access both work through that same mechanism, so they share this check.
  if (lesson && (["premium_only", "trial_only", "admin_granted"] as AccessPolicy[]).includes(lesson.access_policy)) {
    return { allowed: false, reason: "premium_required", resetAt: getISTNextMidnight().toISOString() };
  }

  // 7. Find if lesson is already completed
  const progressRows = await sql`
    SELECT status FROM user_lesson_progress
    WHERE user_email = ${email} AND lesson_id = ${lessonId} LIMIT 1
  ` as { status: string }[];
  if (progressRows[0]?.status === "completed") {
    return { allowed: true, reason: "completed" };
  }

  // 8. Fetch all lessons in active target level in path order, excluding ones explicitly
  //    gated away from the free-daily sequential pool (premium_only/trial_only/admin_granted).
  //    daily_sequence_position overrides sort_order for ordering when an admin has set it.
  const targetLevel = profile.target_level || "N5";
  const levelLessons = await sql`
    SELECT l.id FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE lv.code = ${targetLevel}
      AND l.access_policy NOT IN ('premium_only', 'trial_only', 'admin_granted')
    ORDER BY lv.sort_order, m.sort_order, sm.sort_order,
             COALESCE(l.daily_sequence_position, l.sort_order), l.sort_order, l.code
  ` as { id: string }[];

  // Fetch completed lessons of active target level
  const completedRows = await sql`
    SELECT lesson_id FROM user_lesson_progress
    WHERE user_email = ${email} AND status = 'completed'
  ` as { lesson_id: string }[];
  const completedSet = new Set(completedRows.map((r) => r.lesson_id));

  // Filter out completed lessons to find sequential uncompleted path
  const uncompleted = levelLessons.filter((l) => !completedSet.has(l.id));

  // Determine sequential allowed candidates (next 2 lessons)
  const candidateIds = uncompleted.slice(0, 2).map((l) => l.id);

  if (!candidateIds.includes(lessonId)) {
    return {
      allowed: false,
      reason: "sequential_lock",
      resetAt: getISTNextMidnight().toISOString()
    };
  }

  // 9. Daily limit check (reset at midnight IST), quota read from site_settings.free_daily_limit
  //    (previously hardcoded to 2 and the admin setting was dead configuration).
  const dateKey = getISTDateKey();
  const freeDailyLimit = await getFreeDailyLimit();
  const dailyAccessRows = await sql`
    SELECT lessons_consumed, lessons_allowed FROM daily_lesson_access
    WHERE user_email = ${email} AND date_key = ${dateKey} LIMIT 1
  ` as { lessons_consumed: number; lessons_allowed: number }[];

  const dailyAccess = dailyAccessRows[0] || { lessons_consumed: 0, lessons_allowed: freeDailyLimit };

  // Check if this lesson has already been logged as accessed today (IST day boundary,
  // consistent with the daily quota's own day boundary — previously this check used UTC).
  const logRows = await sql`
    SELECT id FROM lesson_access_logs
    WHERE user_email = ${email} AND lesson_id = ${lessonId}
      AND accessed_at >= ${getISTDayStartUTC()}
    LIMIT 1
  ` as { id: string }[];

  const alreadyAccessedToday = logRows.length > 0;

  if (!alreadyAccessedToday && dailyAccess.lessons_consumed >= dailyAccess.lessons_allowed) {
    return {
      allowed: false,
      reason: "daily_limit_reached",
      resetAt: getISTNextMidnight().toISOString()
    };
  }

  return { allowed: true, reason: "free_daily" };
}

/**
 * Records a lesson access event and increments consumption if first access today.
 */
export async function recordLessonAccess(email: string, lessonId: string): Promise<void> {
  if (!sql) return;

  const access = await canAccessLesson(email, lessonId);
  if (!access.allowed) {
    throw new Error(`Access Denied: ${access.reason}`);
  }

  // Only the free-daily mechanism consumes a slot — premium/completed/always_free/admin_override
  // are all unlimited and shouldn't be tracked against the quota.
  if (access.reason !== "free_daily") {
    return;
  }

  const dateKey = getISTDateKey();
  const resetAt = getISTNextMidnight();
  const freeDailyLimit = await getFreeDailyLimit();

  // Check if already logged today (IST day boundary, consistent with canAccessLesson).
  const logRows = await sql`
    SELECT id FROM lesson_access_logs
    WHERE user_email = ${email} AND lesson_id = ${lessonId}
      AND accessed_at >= ${getISTDayStartUTC()}
    LIMIT 1
  ` as { id: string }[];

  if (logRows.length > 0) {
    // Already accessed today, no-op
    return;
  }

  // Insert access log
  await sql`
    INSERT INTO lesson_access_logs (user_email, lesson_id, access_type, access_granted)
    VALUES (${email}, ${lessonId}, 'free_daily', true)
  `;

  // Increment daily consumption count
  await sql`
    INSERT INTO daily_lesson_access (user_email, date_key, lessons_allowed, lessons_consumed, reset_at, updated_at)
    VALUES (${email}, ${dateKey}, ${freeDailyLimit}, 1, ${resetAt}, NOW())
    ON CONFLICT (user_email, date_key) DO UPDATE SET
      lessons_consumed = daily_lesson_access.lessons_consumed + 1,
      updated_at = NOW()
  `;
}

/**
 * Validates progress metrics and automatically awards earned badges.
 */
export async function checkAndAwardBadges(email: string, targetLevel: string): Promise<string[]> {
  if (!sql) return [];
  const awarded: string[] = [];

  try {
    // 1. Check N5 Starter (first N5 lesson completed)
    if (targetLevel === "N5") {
      const startBadgeRows = await sql`SELECT id FROM badges WHERE slug = 'n5-starter' LIMIT 1` as { id: string }[];
      const startBadge = startBadgeRows[0];
      if (startBadge) {
        const existingBadge = await sql`SELECT 1 FROM user_badges WHERE user_email = ${email} AND badge_id = ${startBadge.id}` as any[];
        if (existingBadge.length === 0) {
          await sql`
            INSERT INTO user_badges (user_email, badge_id, awarded_at, reason)
            VALUES (${email}, ${startBadge.id}, NOW(), 'Completed first N5 curriculum lesson')
            ON CONFLICT DO NOTHING
          `;
          awarded.push("n5-starter");
        }
      }
    }

    // 2. Check N5 Finisher
    if (targetLevel === "N5") {
      const totalRows = await sql`
        SELECT COUNT(*)::int AS total FROM curriculum_lessons l
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        JOIN curriculum_modules m ON m.id = sm.module_id
        JOIN curriculum_levels lv ON lv.id = m.level_id
        WHERE lv.code = 'N5'
      ` as { total: number }[];
      const completedRows = await sql`
        SELECT COUNT(*)::int AS completed FROM user_lesson_progress p
        JOIN curriculum_lessons l ON l.id = p.lesson_id
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        JOIN curriculum_modules m ON m.id = sm.module_id
        JOIN curriculum_levels lv ON lv.id = m.level_id
        WHERE lv.code = 'N5' AND p.user_email = ${email} AND p.status = 'completed'
      ` as { completed: number }[];
      if (totalRows[0]?.total > 0 && totalRows[0].total === completedRows[0]?.completed) {
        const endBadgeRows = await sql`SELECT id FROM badges WHERE slug = 'n5-finisher' LIMIT 1` as { id: string }[];
        const endBadge = endBadgeRows[0];
        if (endBadge) {
          const existingBadge = await sql`SELECT 1 FROM user_badges WHERE user_email = ${email} AND badge_id = ${endBadge.id}` as any[];
          if (existingBadge.length === 0) {
            await sql`
              INSERT INTO user_badges (user_email, badge_id, awarded_at, reason)
              VALUES (${email}, ${endBadge.id}, NOW(), 'Completed all N5 curriculum lessons')
              ON CONFLICT DO NOTHING
            `;
            awarded.push("n5-finisher");
          }
        }
      }
    }

    // 3. Check 3-Day Spark and 7-Day Streak
    const profileRows = await sql`
      SELECT current_streak FROM profiles WHERE email = ${email} LIMIT 1
    ` as { current_streak: number }[];
    const streak = profileRows[0]?.current_streak ?? 0;
    if (streak >= 3) {
      const bRows = await sql`SELECT id FROM badges WHERE slug = '3-day-spark' LIMIT 1` as { id: string }[];
      if (bRows[0]) {
        const existing = await sql`SELECT 1 FROM user_badges WHERE user_email = ${email} AND badge_id = ${bRows[0].id}` as any[];
        if (existing.length === 0) {
          await sql`
            INSERT INTO user_badges (user_email, badge_id, awarded_at, reason)
            VALUES (${email}, ${bRows[0].id}, NOW(), 'Maintained a 3-day learning streak')
            ON CONFLICT DO NOTHING
          `;
          awarded.push("3-day-spark");
        }
      }
    }
    if (streak >= 7) {
      const bRows = await sql`SELECT id FROM badges WHERE slug = '7-day-streak' LIMIT 1` as { id: string }[];
      if (bRows[0]) {
        const existing = await sql`SELECT 1 FROM user_badges WHERE user_email = ${email} AND badge_id = ${bRows[0].id}` as any[];
        if (existing.length === 0) {
          await sql`
            INSERT INTO user_badges (user_email, badge_id, awarded_at, reason)
            VALUES (${email}, ${bRows[0].id}, NOW(), 'Maintained a 7-day learning streak')
            ON CONFLICT DO NOTHING
          `;
          awarded.push("7-day-streak");
        }
      }
    }
  } catch (badgeErr) {
    console.error("Failed auto-badge calculation:", badgeErr);
  }

  return awarded;
}
