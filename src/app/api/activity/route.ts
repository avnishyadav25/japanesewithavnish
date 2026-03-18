import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const STREAK_MILESTONES = [3, 7, 14, 30];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ ok: true }); // no-op without DB

  const body = await req.json().catch(() => ({}));
  const kind = (body.kind as string) || "activity"; // activity | daily_login | exercise_complete

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const profileRows = await sql`
      SELECT last_activity_date, current_streak, longest_streak
      FROM profiles WHERE email = ${session.email} LIMIT 1
    ` as { last_activity_date: string | null; current_streak: number; longest_streak: number }[];

    const prev = profileRows[0];
    let newStreak = 1;
    if (prev?.last_activity_date) {
      const last = prev.last_activity_date.slice(0, 10);
      if (last === today) {
        newStreak = prev.current_streak ?? 0;
      } else {
        const lastDate = new Date(last);
        const todayDate = new Date(today);
        const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) newStreak = (prev.current_streak ?? 0) + 1;
      }
    }
    const longest = Math.max(newStreak, prev?.longest_streak ?? 0);

    await sql`
      INSERT INTO profiles (email, last_activity_date, current_streak, longest_streak, updated_at)
      VALUES (${session.email}, ${today}::date, ${newStreak}, ${longest}, NOW())
      ON CONFLICT (email) DO UPDATE SET
        last_activity_date = ${today}::date,
        current_streak = ${newStreak},
        longest_streak = ${longest},
        updated_at = NOW()
    `;

    if (kind === "daily_login" || kind === "activity") {
      const existing = await sql`
        SELECT 1 FROM reward_events
        WHERE user_email = ${session.email} AND reward_type = 'daily_login'
          AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
        LIMIT 1
      `;
      if (!Array.isArray(existing) || existing.length === 0) {
        await sql`
          INSERT INTO reward_events (user_email, reward_type, points) VALUES (${session.email}, 'daily_login', 10)
        `;
      }
    }
    if (kind === "exercise_complete") {
      await sql`
        INSERT INTO reward_events (user_email, reward_type, points) VALUES (${session.email}, 'exercise_complete', 5)
      `;
    }
    if (STREAK_MILESTONES.includes(newStreak)) {
      await sql`
        INSERT INTO reward_events (user_email, reward_type, points)
        VALUES (${session.email}, ${`streak_${newStreak}`}, ${newStreak * 5})
      `;
      const code = `streak_${newStreak}`;
      const defRows = await sql`SELECT id FROM achievement_definitions WHERE code = ${code} LIMIT 1` as { id: string }[];
      if (defRows[0]) {
        await sql`
          INSERT INTO user_achievements (user_email, achievement_id)
          VALUES (${session.email}, ${defRows[0].id})
          ON CONFLICT (user_email, achievement_id) DO NOTHING
        `.catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, current_streak: newStreak, longest_streak: longest });
  } catch (e) {
    console.error("Activity POST:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
