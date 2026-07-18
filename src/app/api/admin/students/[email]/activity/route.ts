import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

type ActivityEvent = {
  type: "tutor_chat" | "lesson_progress" | "srs_review" | "reward" | "login";
  timestamp: string;
  summary: string;
  detail?: string | null;
};

/** Merged activity trace for the admin user-detail page (decision #7): tutor chat, lesson
 * progress, SRS review scheduling, XP/points changes (reward_events — already a real ledger,
 * so no new table needed there), and login history. Each source is queried independently and
 * merged/sorted in application code rather than a UNION, since the row shapes differ too much
 * to usefully union in SQL. */
export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { email: rawEmail } = await params;
  const userEmail = decodeURIComponent(rawEmail);

  const [tutorRows, progressRows, reviewRows, rewardRows, loginRows] = await Promise.all([
    sql`SELECT question, answer, last_asked_at FROM tutor_logs WHERE user_email = ${userEmail} ORDER BY last_asked_at DESC LIMIT 20`,
    sql`SELECT content_slug, status, last_reviewed_at, updated_at FROM user_learning_progress WHERE user_email = ${userEmail} ORDER BY updated_at DESC LIMIT 20`,
    sql`SELECT item_type, item_id, next_review_at, repetitions, updated_at FROM review_schedule WHERE user_email = ${userEmail} ORDER BY updated_at DESC LIMIT 20`,
    sql`SELECT reward_type, points, created_at FROM reward_events WHERE user_email = ${userEmail} ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT logged_in_at, ip_address, user_agent FROM user_login_events WHERE user_email = ${userEmail} ORDER BY logged_in_at DESC LIMIT 20`,
  ]);

  const events: ActivityEvent[] = [];

  for (const r of tutorRows as { question: string; answer: string; last_asked_at: string }[]) {
    events.push({
      type: "tutor_chat",
      timestamp: r.last_asked_at,
      summary: `Asked the tutor: "${r.question.length > 80 ? r.question.slice(0, 80) + "…" : r.question}"`,
      detail: r.answer.length > 200 ? r.answer.slice(0, 200) + "…" : r.answer,
    });
  }
  for (const r of progressRows as { content_slug: string; status: string; last_reviewed_at: string | null; updated_at: string }[]) {
    events.push({
      type: "lesson_progress",
      timestamp: r.updated_at,
      summary: `${r.content_slug} marked "${r.status}"`,
      detail: r.last_reviewed_at ? `Last reviewed ${new Date(r.last_reviewed_at).toLocaleString()}` : null,
    });
  }
  for (const r of reviewRows as { item_type: string; item_id: string; next_review_at: string; repetitions: number; updated_at: string }[]) {
    events.push({
      type: "srs_review",
      timestamp: r.updated_at,
      summary: `SRS: ${r.item_type} "${r.item_id}" — rep #${r.repetitions}`,
      detail: `Next review: ${new Date(r.next_review_at).toLocaleString()}`,
    });
  }
  for (const r of rewardRows as { reward_type: string; points: number; created_at: string }[]) {
    events.push({
      type: "reward",
      timestamp: r.created_at,
      summary: `${r.points >= 0 ? "+" : ""}${r.points} points — ${r.reward_type}`,
    });
  }
  for (const r of loginRows as { logged_in_at: string; ip_address: string | null; user_agent: string | null }[]) {
    events.push({
      type: "login",
      timestamp: r.logged_in_at,
      summary: "Logged in",
      detail: [r.ip_address, r.user_agent].filter(Boolean).join(" — ") || null,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return NextResponse.json(events.slice(0, 50));
}
