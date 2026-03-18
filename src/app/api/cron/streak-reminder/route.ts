import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendStreakReminder } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Call from a cron job (e.g. Vercel cron or external scheduler) with ?key=CRON_SECRET.
 * Finds users who: haven't had activity today, have current_streak >= 1 (or opted in),
 * and haven't received a streak reminder today. Sends one email per user and records last_streak_reminder_sent_at.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (CRON_SECRET && key !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ sent: 0, message: "Database unavailable" });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const rows = await sql`
      SELECT p.email, p.current_streak
      FROM profiles p
      WHERE (p.last_activity_date IS NULL OR p.last_activity_date < ${today}::date)
        AND (p.current_streak >= 1 OR p.streak_reminder_email_opt_out = FALSE)
        AND (p.last_streak_reminder_sent_at IS NULL OR p.last_streak_reminder_sent_at < ${today}::date)
      LIMIT 100
    ` as { email: string; current_streak: number }[];

    let sent = 0;
    for (const r of rows || []) {
      try {
        await sendStreakReminder(r.email, r.current_streak || 1);
        await sql`
          UPDATE profiles SET last_streak_reminder_sent_at = ${today}::date, updated_at = NOW() WHERE email = ${r.email}
        `;
        sent++;
      } catch (e) {
        console.error("Streak reminder send failed for", r.email, e);
      }
    }
    return NextResponse.json({ sent, total: rows?.length ?? 0 });
  } catch (e) {
    console.error("Streak reminder cron:", e);
    return NextResponse.json({ error: "Failed", sent: 0 }, { status: 500 });
  }
}
