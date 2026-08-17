/**
 * Deliveries — "this copy went to this channel, and here is where it landed".
 *
 * This is the half that did not exist before: `/admin/social` could generate copy for nine
 * platforms and had nowhere to record that any of it was ever posted. The 30-day plan doc's own
 * instruction was "track what you post in a spreadsheet".
 *
 * A row is created when something is queued or hand-posted, never at generation time — an
 * unposted variant is simply a variant.
 */
import { sql } from "@/lib/db";
import type { DeliveryMode, PostStatus, SocialPostRow } from "./types";
import type { PlatformId } from "./platforms";

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new Error("Database unavailable");
  return sql;
}

type Row = Record<string, unknown>;

function toPost(r: Row): SocialPostRow {
  return {
    id: String(r.id),
    variantId: String(r.variant_id),
    channelId: String(r.channel_id),
    status: r.status as PostStatus,
    delivery: r.delivery as DeliveryMode,
    scheduledFor: (r.scheduled_for as string) ?? null,
    attemptCount: Number(r.attempt_count ?? 0),
    maxAttempts: Number(r.max_attempts ?? 3),
    externalId: (r.external_id as string) ?? null,
    externalUrl: (r.external_url as string) ?? null,
    externalState: (r.external_state as string) ?? null,
    uploadSessionUrl: (r.upload_session_url as string) ?? null,
    uploadOffset: Number(r.upload_offset ?? 0),
    postedBy: (r.posted_by as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    verifiedAt: (r.verified_at as string) ?? null,
    errorMessage: (r.error_message as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export interface QueuePostInput {
  variantId: string;
  channelId: string;
  scheduledFor?: string | null;
  delivery: DeliveryMode;
  actor: string;
}

/**
 * Creates or revives a delivery row.
 *
 * `idx_social_posts_one_active` makes a second live row for the same (variant, channel)
 * impossible, so a double-click cannot produce two posts. A previously failed or cancelled
 * attempt is outside that index and is reused rather than duplicated, which keeps the retry
 * history on one row.
 */
export async function queuePost(input: QueuePostInput): Promise<SocialPostRow> {
  const db = requireSql();
  const status: PostStatus =
    input.delivery === "manual" ? "awaiting_manual" : input.scheduledFor ? "scheduled" : "queued";

  const existing = (await db`
    SELECT * FROM social_posts
    WHERE variant_id = ${input.variantId} AND channel_id = ${input.channelId}
    ORDER BY created_at DESC LIMIT 1
  `) as Row[];

  if (existing.length > 0) {
    const current = toPost(existing[0]);
    if (["scheduled", "queued", "claimed", "uploading", "published"].includes(current.status)) {
      return current;
    }
    const revived = (await db`
      UPDATE social_posts
         SET status = ${status}, delivery = ${input.delivery},
             scheduled_for = ${input.scheduledFor ?? null}, error_message = NULL,
             upload_session_url = NULL, upload_offset = 0
       WHERE id = ${current.id}
      RETURNING *
    `) as Row[];
    return toPost(revived[0]);
  }

  const rows = (await db`
    INSERT INTO social_posts (variant_id, channel_id, status, delivery, scheduled_for)
    VALUES (${input.variantId}, ${input.channelId}, ${status}, ${input.delivery}, ${input.scheduledFor ?? null})
    RETURNING *
  `) as Row[];
  return toPost(rows[0]);
}

/**
 * The manual path's completion step: you posted it, you paste the URL back.
 *
 * `verified_at` is set here because a human just looked at the live post — that is a stronger
 * signal than any API's success response, and it is the same column the automated `verify()`
 * pass will write later.
 */
export async function markPostedManually(input: {
  postId: string;
  externalUrl: string;
  postedAt?: string | null;
  actor: string;
}): Promise<SocialPostRow> {
  const db = requireSql();
  const rows = (await db`
    UPDATE social_posts
       SET status = 'published',
           external_url = ${input.externalUrl},
           published_at = COALESCE(${input.postedAt ?? null}::timestamptz, NOW()),
           verified_at = NOW(),
           posted_by = ${input.actor},
           error_message = NULL
     WHERE id = ${input.postId}
    RETURNING *
  `) as Row[];
  if (rows.length === 0) throw new Error("Post not found");
  return toPost(rows[0]);
}

export async function setPostStatus(postId: string, status: PostStatus): Promise<void> {
  const db = requireSql();
  await db`UPDATE social_posts SET status = ${status} WHERE id = ${postId}`;
}

export async function failPost(postId: string, message: string, retryable: boolean): Promise<void> {
  const db = requireSql();
  await db`
    UPDATE social_posts
       SET status = CASE WHEN ${retryable} AND attempt_count + 1 < max_attempts THEN 'queued' ELSE 'failed' END,
           attempt_count = attempt_count + 1,
           error_message = ${message}
     WHERE id = ${postId}
  `;
}

export async function listPostsForBrief(briefId: string): Promise<(SocialPostRow & { platform: PlatformId; surface: string; lang: string })[]> {
  const db = requireSql();
  const rows = (await db`
    SELECT sp.*, v.platform, v.surface, v.lang
    FROM social_posts sp
    JOIN social_variants v ON v.id = sp.variant_id
    WHERE v.brief_id = ${briefId}
    ORDER BY sp.created_at DESC
  `) as Row[];
  return rows.map((r) => ({
    ...toPost(r),
    platform: r.platform as PlatformId,
    surface: String(r.surface),
    lang: String(r.lang),
  }));
}

/**
 * Per-platform status for one render, for the line under the render card.
 *
 * Deliberately does NOT count `video_content_links` as "posted": an on-site embed is a different
 * distribution channel, and conflating the two would hide exactly the gap this is here to show.
 */
export async function publicationSummaryForRender(
  renderId: string
): Promise<{ platform: PlatformId; status: PostStatus; url: string | null }[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT DISTINCT ON (v.platform) v.platform, sp.status, sp.external_url
    FROM social_posts sp
    JOIN social_variants v ON v.id = sp.variant_id
    JOIN social_briefs  b ON b.id = v.brief_id
    WHERE b.render_id = ${renderId}
    ORDER BY v.platform,
             -- One row per platform, showing the furthest state reached rather than the newest.
             CASE sp.status WHEN 'published' THEN 0 WHEN 'uploading' THEN 1 WHEN 'queued' THEN 2
                            WHEN 'scheduled' THEN 3 WHEN 'awaiting_manual' THEN 4 ELSE 5 END,
             sp.created_at DESC
  `) as Row[];
  return rows.map((r) => ({
    platform: r.platform as PlatformId,
    status: r.status as PostStatus,
    url: (r.external_url as string) ?? null,
  }));
}

/**
 * Attaches publication summaries to a render list, for the current renders only.
 *
 * WHY THIS IS SHARED: the project page did this inline, and the poll endpoint that refreshes the
 * same list did not. Every poll therefore replaced cards carrying "Posted: instagram, x" with
 * "Not posted anywhere yet" until a full page refresh — the data was never wrong in the database,
 * only in the half of the round trip that forgot to load it. Two callers, one implementation.
 *
 * Superseded renders are skipped rather than looked up: their cards do not show a status line, so
 * the query would be paid for and thrown away.
 */
export async function attachPublications<T extends { id: string; isCurrent: boolean }>(
  renders: T[]
): Promise<(T & { publications?: { platform: PlatformId; status: PostStatus; url: string | null }[] })[]> {
  const current = renders.filter((r) => r.isCurrent);
  if (current.length === 0) return renders;

  const summaries = await Promise.all(current.map((r) => publicationSummaryForRender(r.id)));
  const byRender = new Map(current.map((r, i) => [r.id, summaries[i]]));
  return renders.map((r) => ({ ...r, publications: byRender.get(r.id) }));
}
