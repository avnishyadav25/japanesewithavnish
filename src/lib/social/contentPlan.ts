/**
 * The numbers behind "what should I make next".
 *
 * Structured like src/lib/contentReview/dashboardQueries.ts: all the heavy SQL in one module,
 * awaited together by the page, snake_case never escaping this file.
 *
 * Every figure here gets acted on — a month of work gets scheduled off the coverage matrix — so
 * each query states its definition explicitly and the UI prints that definition next to the
 * number. A dashboard that is subtly wrong is worse than no dashboard.
 */
import { sql } from "@/lib/db";
import { PLATFORM_RULES, SURFACES, type PlatformId, type SurfaceId } from "./platforms";

type Row = Record<string, unknown>;

/** Content types worth making videos from. Excludes `blog`, which is already long-form prose. */
export const VIDEO_CONTENT_TYPES = [
  "vocabulary",
  "kanji",
  "grammar",
  "reading",
  "listening",
  "writing",
  "sounds",
  "study_guide",
] as const;

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

export interface VideoCoverageCell {
  level: string;
  contentType: string;
  total: number;
  withVideo: number;
  withoutVideo: number;
}

/**
 * How much published content has a video, by level and type.
 *
 * DEFINITION, printed in the UI verbatim: a post "has video" when it appears in the content
 * snapshot of a storyboard whose project has a CURRENT, non-rejected render. A project that was
 * scripted but never rendered does not count. A superseded render does not count.
 *
 * KNOWN OVERSTATEMENT: a `video_per_item` batch covering 20 words marks all 20 as covered even
 * though each got a fraction of one video. That is the honest reading of "this content appeared
 * in a video", but it is not the same as "this content has its own video", and the difference
 * matters when the number is used to decide what to make next.
 */
export async function getVideoCoverageMatrix(): Promise<VideoCoverageCell[]> {
  if (!sql) return [];
  const rows = (await sql`
    WITH covered AS (
      SELECT DISTINCT p.id AS post_id
      FROM video_storyboards s
      JOIN video_renders r
        ON r.project_id = s.project_id AND r.is_current AND r.approval_status <> 'rejected'
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.content_snapshot->'items', '[]'::jsonb)) AS item
      -- postId is optional on ContentItem, so slug is the fallback join. Without it, every
      -- storyboard written before postId was populated would read as zero coverage.
      JOIN posts p
        ON (item->>'postId' IS NOT NULL AND p.id = (item->>'postId')::uuid)
        OR (item->>'postId' IS NULL AND item->>'slug' IS NOT NULL AND p.slug = item->>'slug')
    )
    SELECT COALESCE((pp.jlpt_level)[1], 'unlevelled')       AS level,
           COALESCE(pp.content_type, 'untyped')             AS content_type,
           COUNT(*)::int                                    AS total,
           COUNT(c.post_id)::int                            AS with_video,
           (COUNT(*) - COUNT(c.post_id))::int               AS without_video
    FROM posts pp
    LEFT JOIN covered c ON c.post_id = pp.id
    WHERE pp.status = 'published'
      AND pp.content_type = ANY(${[...VIDEO_CONTENT_TYPES]})
    GROUP BY level, content_type
    ORDER BY level, content_type
  `) as Row[];

  return rows.map((r) => ({
    level: String(r.level),
    contentType: String(r.content_type),
    total: Number(r.total),
    withVideo: Number(r.with_video),
    withoutVideo: Number(r.without_video),
  }));
}

export interface UnpostedRender {
  renderId: string;
  projectId: string;
  title: string;
  format: string;
  narrationLang: string;
  durationSeconds: number | null;
  createdAt: string;
  /** Embedded on the site, which is a different channel from social. */
  siteLinks: number;
}

/**
 * Renders that are current, watchable, and have never reached a social platform.
 *
 * The on-site embed (`video_content_links`) is deliberately NOT counted as posted. It is a
 * different distribution channel, and treating it as one would hide the entire gap this page
 * exists to surface — a video embedded on its lesson page has still been seen by nobody new.
 */
export async function getUnpostedRenders(limit = 50): Promise<UnpostedRender[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT r.id AS render_id, r.project_id, pr.title, r.format, r.narration_lang,
           r.duration_seconds, r.created_at::text AS created_at,
           (SELECT COUNT(*)::int FROM video_content_links l
             WHERE l.render_id = r.id AND l.is_published) AS site_links
    FROM video_renders r
    JOIN video_projects pr ON pr.id = r.project_id
    WHERE r.is_current
      AND r.approval_status <> 'rejected'
      AND NOT EXISTS (
        SELECT 1 FROM social_posts sp
        JOIN social_variants v ON v.id = sp.variant_id
        JOIN social_briefs  b ON b.id = v.brief_id
        WHERE b.render_id = r.id
          AND sp.status IN ('scheduled','queued','claimed','uploading','published')
      )
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `) as Row[];

  return rows.map((r) => ({
    renderId: String(r.render_id),
    projectId: String(r.project_id),
    title: String(r.title),
    format: String(r.format),
    narrationLang: String(r.narration_lang),
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    createdAt: String(r.created_at),
    siteLinks: Number(r.site_links),
  }));
}

export interface PipelineCounts {
  projectsByStatus: { status: string; count: number }[];
  rendersCurrent: number;
  rendersPosted: number;
  rendersUnposted: number;
  variantsDraft: number;
  postsAwaitingManual: number;
}

/** The in-flight view, including the distribution stages nothing surfaced before. */
export async function getPipelineCounts(): Promise<PipelineCounts> {
  if (!sql) {
    return { projectsByStatus: [], rendersCurrent: 0, rendersPosted: 0, rendersUnposted: 0, variantsDraft: 0, postsAwaitingManual: 0 };
  }

  const [projects, renders, variants, posts] = await Promise.all([
    sql`SELECT status, COUNT(*)::int AS n FROM video_projects GROUP BY status ORDER BY n DESC` as Promise<Row[]>,
    sql`
      SELECT COUNT(*)::int AS current,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM social_posts sp
               JOIN social_variants v ON v.id = sp.variant_id
               JOIN social_briefs  b ON b.id = v.brief_id
               WHERE b.render_id = r.id AND sp.status = 'published'
             ))::int AS posted
      FROM video_renders r
      WHERE r.is_current AND r.approval_status <> 'rejected'
    ` as Promise<Row[]>,
    sql`SELECT COUNT(*)::int AS n FROM social_variants WHERE is_current AND approval_status = 'draft'` as Promise<Row[]>,
    sql`SELECT COUNT(*)::int AS n FROM social_posts WHERE status = 'awaiting_manual'` as Promise<Row[]>,
  ]);

  const current = Number(renders[0]?.current ?? 0);
  const posted = Number(renders[0]?.posted ?? 0);

  return {
    projectsByStatus: projects.map((r) => ({ status: String(r.status), count: Number(r.n) })),
    rendersCurrent: current,
    rendersPosted: posted,
    rendersUnposted: current - posted,
    variantsDraft: Number(variants[0]?.n ?? 0),
    postsAwaitingManual: Number(posts[0]?.n ?? 0),
  };
}

export interface CadenceLoad {
  platform: PlatformId;
  posted7d: number;
  budgetPerWeek: number;
  lastPostedAt: string | null;
}

/** Actual posting rate per platform against the target cadence in PLATFORM_RULES. */
export async function getCadenceLoad(): Promise<CadenceLoad[]> {
  const budgets = new Map<PlatformId, number>();
  for (const surface of SURFACES) {
    const rule = PLATFORM_RULES[surface];
    budgets.set(rule.platform, (budgets.get(rule.platform) ?? 0) + rule.cadence.perWeek);
  }

  const actual = new Map<string, { n: number; last: string | null }>();
  if (sql) {
    const rows = (await sql`
      SELECT v.platform,
             COUNT(*) FILTER (WHERE sp.published_at > NOW() - INTERVAL '7 days')::int AS n,
             MAX(sp.published_at)::text AS last
      FROM social_posts sp
      JOIN social_variants v ON v.id = sp.variant_id
      WHERE sp.status = 'published'
      GROUP BY v.platform
    `) as Row[];
    for (const r of rows) actual.set(String(r.platform), { n: Number(r.n), last: (r.last as string) ?? null });
  }

  return Array.from(budgets.entries())
    .map(([platform, budgetPerWeek]) => ({
      platform,
      budgetPerWeek: Math.round(budgetPerWeek * 10) / 10,
      posted7d: actual.get(platform)?.n ?? 0,
      lastPostedAt: actual.get(platform)?.last ?? null,
    }))
    .sort((a, b) => b.budgetPerWeek - a.budgetPerWeek);
}

export interface GapCandidate {
  postId: string;
  slug: string;
  title: string;
  contentType: string;
  jlptLevel: string | null;
}

/** Published content with no video, for the planner to draw topics from. */
export async function getTopGapCandidates(limit = 40): Promise<GapCandidate[]> {
  if (!sql) return [];
  const rows = (await sql`
    WITH covered AS (
      SELECT DISTINCT p.id AS post_id
      FROM video_storyboards s
      JOIN video_renders r
        ON r.project_id = s.project_id AND r.is_current AND r.approval_status <> 'rejected'
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.content_snapshot->'items', '[]'::jsonb)) AS item
      JOIN posts p
        ON (item->>'postId' IS NOT NULL AND p.id = (item->>'postId')::uuid)
        OR (item->>'postId' IS NULL AND item->>'slug' IS NOT NULL AND p.slug = item->>'slug')
    )
    SELECT pp.id, pp.slug, pp.title, pp.content_type, (pp.jlpt_level)[1] AS lvl
    FROM posts pp
    LEFT JOIN covered c ON c.post_id = pp.id
    WHERE pp.status = 'published'
      AND pp.content_type = ANY(${[...VIDEO_CONTENT_TYPES]})
      AND c.post_id IS NULL
    -- Lower levels first: that is where the audience is, and N5 content converts best.
    ORDER BY array_position(ARRAY['N5','N4','N3','N2','N1'], (pp.jlpt_level)[1]) NULLS LAST,
             pp.content_type, pp.updated_at DESC
    LIMIT ${limit}
  `) as Row[];

  return rows.map((r) => ({
    postId: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    contentType: String(r.content_type),
    jlptLevel: (r.lvl as string) ?? null,
  }));
}

/** Hashtag stacks used recently, so the planner can avoid repeating one. */
export async function recentHashtagStacks(platform: PlatformId, days = 14): Promise<string[][]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT v.hashtags
    FROM social_posts sp
    JOIN social_variants v ON v.id = sp.variant_id
    WHERE sp.status = 'published' AND v.platform = ${platform}
      AND sp.published_at > NOW() - (${days} || ' days')::interval
    ORDER BY sp.published_at DESC
    LIMIT 30
  `) as Row[];
  return rows.map((r) => (r.hashtags as string[]) ?? []);
}

export interface PlanSlot {
  date: string;
  platform: PlatformId;
  surface: SurfaceId;
}

/**
 * The calendar skeleton: which platform posts on which day.
 *
 * PURE, and computed from `PLATFORM_RULES.cadence` rather than asked of the model. An LLM given
 * "lay out 30 days" produces February 30th and LinkedIn posts on a Sunday. The model's job is to
 * fill in topics, which is the part it is actually good at — the same skeleton-plus-blanks
 * contract the storyboard generator uses.
 */
export function buildPlanSkeleton(startsOn: string, days: number): PlanSlot[] {
  const slots: PlanSlot[] = [];
  const start = new Date(`${startsOn}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid start date: ${startsOn}`);

  const planned = SURFACES.filter((s) => PLATFORM_RULES[s].cadence.perWeek > 0 && PLATFORM_RULES[s].platform !== "blog");

  planned.forEach((surface, index) => {
    const rule = PLATFORM_RULES[surface];
    const preferred = rule.cadence.preferredWeekdays;

    if (preferred && preferred.length > 0) {
      // Place ON the preferred days rather than spacing and then filtering. Filtering silently
      // drops the slots that miss, so LinkedIn's "3 a week, Mon/Wed/Fri" would quietly become
      // one or two — the cadence and the preference have to be satisfied together.
      let placedThisWeek = 0;
      let week = 0;
      for (let day = 0; day < days; day++) {
        const date = new Date(start.getTime() + day * 86_400_000);
        const currentWeek = Math.floor(day / 7);
        if (currentWeek !== week) {
          week = currentWeek;
          placedThisWeek = 0;
        }
        if (!preferred.includes(date.getUTCDay())) continue;
        if (placedThisWeek >= rule.cadence.perWeek) continue;
        placedThisWeek += 1;
        slots.push({ date: date.toISOString().slice(0, 10), platform: rule.platform, surface });
      }
      return;
    }

    // Spacing in days, so 3/week lands roughly every other day rather than three days running.
    const spacing = Math.max(1, Math.round(7 / rule.cadence.perWeek));
    // Stagger each surface's first slot. Without this every surface starts on day 0 and the
    // first day carries all fourteen while later days carry two — technically the right weekly
    // totals, and a completely unusable calendar.
    const offset = index % spacing;

    for (let day = offset; day < days; day += spacing) {
      const date = new Date(start.getTime() + day * 86_400_000);
      slots.push({ date: date.toISOString().slice(0, 10), platform: rule.platform, surface });
    }
  });

  return slots.sort((a, b) => (a.date === b.date ? a.platform.localeCompare(b.platform) : a.date.localeCompare(b.date)));
}

/** Slots grouped by date, for rendering the calendar. */
export function groupSlotsByDate(slots: PlanSlot[]): { date: string; slots: PlanSlot[] }[] {
  const map = new Map<string, PlanSlot[]>();
  for (const slot of slots) map.set(slot.date, [...(map.get(slot.date) ?? []), slot]);
  return Array.from(map.entries())
    .map(([date, s]) => ({ date, slots: s }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
