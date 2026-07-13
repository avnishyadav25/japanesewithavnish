import { sql } from "@/lib/db";
import { draftAdminReply } from "@/lib/ai/reply";
import { sendAdminReplyEmail } from "@/lib/email";

const NUDGE_COOLDOWN_DAYS = 3;

const FALLBACK_PROMPT =
  "You are a warm, encouraging Japanese-learning coach for Japanese with Avnish. Write a short, personal re-engagement email to a student who has been inactive for a few days. Reference their in-progress lesson if provided, gently encourage them to come back, and keep it under 100 words with a friendly, non-pushy tone. Output ONLY the email body text, no subject line or labels.";

export type EligibleNudgeUser = {
  email: string;
  displayName: string | null;
  currentStreak: number;
  nextLessonTitle: string | null;
  nextLessonId: string | null;
};

/** Finds inactive, opted-in users not nudged within the cooldown window, with their in-progress
 * lesson for personalization — reuses the same inactivity signal as the streak-reminder cron
 * (last_activity_date stale) and the same "next lesson" query as /api/learn/progress. */
export async function findEligibleNudgeUsers(): Promise<EligibleNudgeUser[]> {
  if (!sql) return [];
  const today = new Date().toISOString().slice(0, 10);

  const profileRows = (await sql`
    SELECT email, display_name, current_streak
    FROM profiles
    WHERE (last_activity_date IS NULL OR last_activity_date < ${today}::date)
      AND (streak_reminder_email_opt_out IS NULL OR streak_reminder_email_opt_out = FALSE)
      AND (last_nudge_sent_at IS NULL OR last_nudge_sent_at <= ${today}::date - ${NUDGE_COOLDOWN_DAYS})
  `) as { email: string; display_name: string | null; current_streak: number | null }[];

  const users: EligibleNudgeUser[] = [];
  for (const p of profileRows ?? []) {
    const nextLessonRows = (await sql`
      SELECT l.id, l.title
      FROM curriculum_lessons l
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      JOIN curriculum_levels lv ON lv.id = m.level_id
      WHERE NOT EXISTS (
        SELECT 1 FROM user_lesson_progress ulp WHERE ulp.user_email = ${p.email} AND ulp.lesson_id = l.id AND ulp.status = 'completed'
      )
      ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order
      LIMIT 1
    `.catch(() => [])) as { id: string; title: string }[];
    const nextLesson = nextLessonRows?.[0] ?? null;

    users.push({
      email: p.email,
      displayName: p.display_name,
      currentStreak: p.current_streak ?? 0,
      nextLessonTitle: nextLesson?.title ?? null,
      nextLessonId: nextLesson?.id ?? null,
    });
  }
  return users;
}

/** Drafts a personalized nudge message via the admin-editable reengagement_nudge prompt. */
export async function draftNudgeMessage(user: EligibleNudgeUser): Promise<{ draft: string } | { error: string }> {
  const context = [
    `Student: ${user.displayName || user.email.split("@")[0]}`,
    `Current streak: ${user.currentStreak} days`,
    user.nextLessonTitle ? `In-progress lesson: ${user.nextLessonTitle}` : "No in-progress lesson recorded.",
  ].join("\n");

  const result = await draftAdminReply({
    promptKey: "reengagement_nudge",
    fallbackSystemPrompt: FALLBACK_PROMPT,
    userContext: context,
  });
  if ("error" in result) return result;
  return { draft: result.draft };
}

/** Sends a nudge email and records last_nudge_sent_at for rate-limiting. */
export async function sendNudge(email: string, body: string) {
  await sendAdminReplyEmail(email, "Pick up where you left off — Japanese with Avnish", body);
  if (sql) {
    await sql`UPDATE profiles SET last_nudge_sent_at = CURRENT_DATE WHERE email = ${email}`;
  }
}
