import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;

/** SM-2: next interval and new ease factor from quality (0=again, 1=hard, 2=good, 3=easy). */
function sm2(quality: number, intervalDays: number, repetitions: number, easeFactor: number): { intervalDays: number; repetitions: number; easeFactor: number } {
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  let newEase = easeFactor + efDelta;
  if (newEase < MIN_EASE) newEase = MIN_EASE;
  if (quality < 3) {
    return { intervalDays: 1, repetitions: 0, easeFactor: newEase };
  }
  let nextInterval: number;
  if (repetitions === 0) nextInterval = 1;
  else if (repetitions === 1) nextInterval = 6;
  else nextInterval = Math.round(intervalDays * newEase);
  if (nextInterval < 1) nextInterval = 1;
  return { intervalDays: nextInterval, repetitions: repetitions + 1, easeFactor: newEase };
}

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized", items: [] }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({ items: [] });
  }
  try {
    const now = new Date().toISOString();
    const rows = await sql`
      SELECT rs.id, rs.item_type, rs.item_id, rs.next_review_at, rs.interval_days, rs.repetitions,
             p.title, p.slug, p.content_type, p.content, p.meta
      FROM review_schedule rs
      LEFT JOIN posts p ON p.slug = rs.item_id AND p.content_type = rs.item_type AND p.status = 'published'
      WHERE rs.user_email = ${session.email} AND rs.next_review_at <= ${now}::timestamptz
      ORDER BY rs.next_review_at ASC
      LIMIT 20
    ` as {
      id: string;
      item_type: string;
      item_id: string;
      next_review_at: string;
      interval_days: number;
      repetitions: number;
      title: string | null;
      slug: string | null;
      content_type: string | null;
      content: string | null;
      meta: unknown;
    }[];

    const items = rows.map((r) => ({
      id: r.id,
      itemType: r.item_type,
      itemId: r.item_id,
      title: r.title ?? r.item_id,
      slug: r.slug ?? r.item_id,
      contentType: r.content_type,
      content: r.content?.slice(0, 500) ?? "",
      meta: r.meta,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("Review GET:", e);
    return NextResponse.json({ items: [] });
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
    const { scheduleId, correct } = body;
    if (!scheduleId || typeof correct !== "boolean") {
      return NextResponse.json({ error: "scheduleId and correct required" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, interval_days, repetitions, ease_factor FROM review_schedule
      WHERE id = ${scheduleId}::uuid AND user_email = ${session.email} LIMIT 1
    ` as { id: string; interval_days: number; repetitions: number; ease_factor: number }[];
    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = rows[0];
    const ease = r.ease_factor != null && r.ease_factor >= MIN_EASE ? r.ease_factor : INITIAL_EASE;
    const quality = correct ? 2 : 0;
    const { intervalDays: nextInterval, repetitions: nextRepetitions, easeFactor: newEase } = sm2(
      quality,
      r.interval_days,
      r.repetitions,
      ease
    );
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + nextInterval);

    await sql`
      UPDATE review_schedule
      SET next_review_at = ${nextReview.toISOString()},
          interval_days = ${nextInterval},
          ease_factor = ${newEase},
          repetitions = ${nextRepetitions},
          updated_at = NOW()
      WHERE id = ${scheduleId}::uuid AND user_email = ${session.email}
    `;
    if (correct) {
      await sql`
        INSERT INTO reward_events (user_email, reward_type, points) VALUES (${session.email}, 'review_complete', 0)
      `.catch(() => {});
    }
    const itemRows = await sql`SELECT item_type, item_id FROM review_schedule WHERE id = ${scheduleId}::uuid LIMIT 1` as { item_type: string; item_id: string }[];
    const item = itemRows[0];
    if (item) {
      await sql`
        INSERT INTO user_response_log (user_email, item_type, item_id, correct)
        VALUES (${session.email}, ${item.item_type}, ${item.item_id}, ${correct})
      `.catch(() => {});
    }
    return NextResponse.json({ success: true, nextInterval });
  } catch (e) {
    console.error("Review POST:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
