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

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized", items: [] }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({ items: [] });
  }
  try {
    const url = new URL(req.url);
    const includeAll = url.searchParams.get("all") === "1";
    const now = new Date().toISOString();
    const rows = await sql`
      SELECT rs.id, rs.item_type, rs.item_id, rs.next_review_at, rs.interval_days, rs.repetitions,
             rs.snapshot_title, rs.snapshot_content,
             p.title AS post_title, p.slug AS post_slug, p.content_type AS post_content_type, p.content, p.meta,
             cl.title AS lesson_title, cl.slug AS lesson_slug, cl.content_type AS lesson_content_type
      FROM review_schedule rs
      LEFT JOIN posts p ON p.slug = rs.item_id AND p.content_type = rs.item_type AND p.status = 'published'
      LEFT JOIN curriculum_lessons cl ON rs.item_type = 'lesson' AND cl.id::text = rs.item_id
      WHERE rs.user_email = ${session.email}
        AND (${includeAll}::boolean = TRUE OR rs.next_review_at <= ${now}::timestamptz)
      ORDER BY rs.next_review_at ASC
      LIMIT 20
    ` as {
      id: string;
      item_type: string;
      item_id: string;
      next_review_at: string;
      interval_days: number;
      repetitions: number;
      snapshot_title: string | null;
      snapshot_content: string | null;
      post_title: string | null;
      post_slug: string | null;
      post_content_type: string | null;
      lesson_title: string | null;
      lesson_slug: string | null;
      lesson_content_type: string | null;
      content: string | null;
      meta: unknown;
    }[];

    const items = rows.map((r) => ({
      id: r.id,
      itemType: r.item_type,
      itemId: r.item_id,
      title: r.lesson_title ?? r.post_title ?? r.snapshot_title ?? r.item_id,
      slug: r.lesson_slug ?? r.post_slug ?? r.item_id,
      contentType: r.lesson_content_type ?? r.post_content_type,
      content: r.content?.slice(0, 500) ?? r.snapshot_content?.slice(0, 500) ?? "",
      meta: r.meta,
      nextReviewAt: r.next_review_at,
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
    if (body.action === "add") {
      const itemType = typeof body.itemType === "string" ? body.itemType : "";
      const snapshotTypes = new Set(["tutor_note", "tutor_flashcard"]);
      const allowedTypes = new Set(["lesson", "vocab", "kanji", "grammar", "reading", "listening", "tutor_note", "tutor_flashcard"]);
      if (!allowedTypes.has(itemType)) {
        return NextResponse.json({ error: "Unsupported review item type" }, { status: 400 });
      }

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 1);

      // Ad-hoc Nihongo Navi answers have no existing post/lesson to key off of —
      // mint a fresh id and store the Q&A text directly.
      if (snapshotTypes.has(itemType)) {
        const snapshotTitle = typeof body.snapshotTitle === "string" ? body.snapshotTitle.slice(0, 200) : "";
        const snapshotContent = typeof body.snapshotContent === "string" ? body.snapshotContent.slice(0, 2000) : "";
        if (!snapshotContent) {
          return NextResponse.json({ error: "snapshotContent required" }, { status: 400 });
        }
        const itemId = crypto.randomUUID();
        await sql`
          INSERT INTO review_schedule (user_email, item_type, item_id, next_review_at, interval_days, snapshot_title, snapshot_content, updated_at)
          VALUES (${session.email}, ${itemType}, ${itemId}, ${nextReview.toISOString()}, 1, ${snapshotTitle || null}, ${snapshotContent}, NOW())
        `;
        return NextResponse.json({ success: true, itemId });
      }

      const itemId = typeof body.itemId === "string" ? body.itemId : "";
      if (!itemId) {
        return NextResponse.json({ error: "itemId required" }, { status: 400 });
      }

      if (itemType === "lesson") {
        const lessonRows = await sql`
          SELECT id FROM curriculum_lessons WHERE id::text = ${itemId} OR slug = ${itemId} LIMIT 1
        ` as { id: string }[];
        if (!lessonRows[0]) {
          return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }
      }

      await sql`
        INSERT INTO review_schedule (user_email, item_type, item_id, next_review_at, interval_days, updated_at)
        VALUES (${session.email}, ${itemType}, ${itemId}, ${nextReview.toISOString()}, 1, NOW())
        ON CONFLICT (user_email, item_type, item_id) DO UPDATE SET
          next_review_at = EXCLUDED.next_review_at,
          interval_days = 1,
          updated_at = NOW()
      `;

      return NextResponse.json({ success: true });
    }

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
