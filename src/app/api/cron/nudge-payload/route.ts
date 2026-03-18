import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;
const REVIEWS_DUE_THRESHOLD = 10;

/**
 * GET /api/cron/nudge-payload?key=CRON_SECRET
 * Returns a JSON payload for external automation (n8n, Make): users who need a nudge.
 * Your automation can then send email/push from its own channels.
 * Payload: { nudges: [ { email, nudgeType, payload } ] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (CRON_SECRET && key !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) return NextResponse.json({ nudges: [] });
  const today = new Date().toISOString().slice(0, 10);
  const nudges: { email: string; nudgeType: string; payload: Record<string, unknown> }[] = [];
  try {
    const dueRows = await sql`
      SELECT p.email, COUNT(rs.id)::int AS due_count
      FROM profiles p
      JOIN review_schedule rs ON rs.user_email = p.email
      WHERE rs.next_review_at <= NOW()
      GROUP BY p.email
      HAVING COUNT(rs.id) >= ${REVIEWS_DUE_THRESHOLD}
    ` as { email: string; due_count: number }[];
    for (const r of dueRows ?? []) {
      nudges.push({
        email: r.email,
        nudgeType: "reviews_due",
        payload: { count: r.due_count, threshold: REVIEWS_DUE_THRESHOLD },
      });
    }
    const streakRows = await sql`
      SELECT p.email, p.current_streak
      FROM profiles p
      WHERE (p.last_activity_date IS NULL OR p.last_activity_date < ${today}::date)
        AND p.current_streak >= 1
        AND (p.streak_reminder_email_opt_out IS NULL OR p.streak_reminder_email_opt_out = FALSE)
    ` as { email: string; current_streak: number }[];
    for (const r of streakRows ?? []) {
      if (!nudges.some((n) => n.email === r.email && n.nudgeType === "streak_at_risk")) {
        nudges.push({
          email: r.email,
          nudgeType: "streak_at_risk",
          payload: { currentStreak: r.current_streak },
        });
      }
    }
    return NextResponse.json({ nudges });
  } catch (e) {
    console.error("Nudge payload cron:", e);
    return NextResponse.json({ error: "Failed", nudges: [] }, { status: 500 });
  }
}
