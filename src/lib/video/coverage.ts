/**
 * How much content is actually VIDEO-READY, per type and level.
 *
 * WHY THIS EXISTS. Every content defect this project has hit was invisible until someone wrote a
 * query: 42 reading posts were live with placeholder text; the `conversation` type had never had a
 * post; kana was unreachable because its table has no `post_id`; 644 kanji had neither an example
 * sentence nor an example word. None of it failed — the videos just came out thin, or the template
 * quietly produced one item instead of three.
 *
 * "Published" is the number the admin already shows and it is the wrong one. A published reading
 * post with no passage cannot become a video. This computes the number that matters: how many
 * items a video generator can actually use.
 */
import { sql } from "@/lib/db";

export interface CoverageRow {
  contentType: string;
  level: string;
  published: number;
  /** Items a video generator can actually use. */
  ready: number;
  /** Why an item is not ready, in one phrase. */
  blocker: string | null;
}

export interface CoverageSummary {
  rows: CoverageRow[];
  /** Content types with zero usable items anywhere, which is the loudest signal. */
  empty: string[];
}

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/**
 * What "ready" means per type, as SQL.
 *
 * Each predicate encodes a real failure that has already happened, rather than a guess at what
 * might go wrong.
 */
const READY_SQL: Record<string, { sql: string; blocker: string }> = {
  vocabulary: {
    sql: `EXISTS (SELECT 1 FROM vocabulary v WHERE v.post_id = p.id)`,
    blocker: "no vocabulary row",
  },
  grammar: {
    sql: `EXISTS (SELECT 1 FROM grammar g WHERE g.post_id = p.id)`,
    blocker: "no grammar row",
  },
  kanji: {
    // A kanji scene needs stroke data OR something concrete to show. Both missing makes it a
    // character on a blank card.
    sql: `EXISTS (SELECT 1 FROM kanji k WHERE k.post_id = p.id AND k.stroke_data IS NOT NULL)`,
    blocker: "no stroke data",
  },
  reading: {
    sql: `jsonb_array_length(COALESCE(p.meta->'sentences','[]'::jsonb)) > 0`,
    blocker: "no passage — page shows a stub",
  },
  listening: {
    sql: `jsonb_array_length(COALESCE(p.meta->'examples','[]'::jsonb)) > 0`,
    blocker: "no audio examples",
  },
  conversation: {
    sql: `jsonb_array_length(COALESCE(p.meta->'turns','[]'::jsonb)) > 0`,
    blocker: "no dialogue turns",
  },
};

export async function contentCoverage(): Promise<CoverageSummary> {
  if (!sql) return { rows: [], empty: [] };
  const rows: CoverageRow[] = [];

  for (const [contentType, spec] of Object.entries(READY_SQL)) {
    const result = (await sql.query(
      `SELECT COALESCE((p.jlpt_level)[1], '--') AS level,
              COUNT(*)::int AS published,
              COUNT(*) FILTER (WHERE ${spec.sql})::int AS ready
       FROM posts p
       WHERE p.status = 'published' AND p.content_type = $1
       GROUP BY level`,
      [contentType]
    )) as { level: string; published: number; ready: number }[];

    for (const level of LEVELS) {
      const found = result.find((r) => r.level === level);
      if (!found || found.published === 0) continue;
      rows.push({
        contentType,
        level,
        published: found.published,
        ready: found.ready,
        blocker: found.ready < found.published ? spec.blocker : null,
      });
    }
  }

  // Kana is counted separately because it lives outside `posts` entirely — the very reason it was
  // unreachable for so long. Reporting it here is what stops that being invisible again.
  const kana = (await sql`SELECT type, COUNT(*)::int c, COUNT(stroke_data)::int ready FROM kana GROUP BY type`) as {
    type: string;
    c: number;
    ready: number;
  }[];
  for (const k of kana) {
    rows.push({ contentType: `kana (${k.type})`, level: "—", published: k.c, ready: k.ready, blocker: k.ready < k.c ? "no stroke data" : null });
  }

  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.contentType, (byType.get(r.contentType) ?? 0) + r.ready);
  const empty = Object.keys(READY_SQL).filter((t) => !byType.get(t));

  return { rows, empty };
}

/** How many videos a given ready-count yields, at a template's items-per-video. */
export function videosFrom(ready: number, itemsPerVideo: number): number {
  return itemsPerVideo > 0 ? Math.ceil(ready / itemsPerVideo) : 0;
}
