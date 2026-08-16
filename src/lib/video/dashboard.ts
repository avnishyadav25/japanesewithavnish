/**
 * The dashboard's "where did my videos actually go" query.
 *
 * Separate from projects.ts because it answers a different question. projects.ts lists rows;
 * this joins the three distribution channels that were previously only visible on three
 * different pages — the render itself, the on-site embed, and the social posts — so the studio
 * home can finally say "rendered, on 3 pages, posted to instagram" in one line.
 *
 * DEFINITIONS, since the filters act on them:
 *   on site   at least one published row in video_content_links
 *   posted    at least one social_post that reached 'published'
 *   unposted  neither of the above — finished work earning nothing
 */
import { sql } from "@/lib/db";

export interface DashboardVideo {
  renderId: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  format: string;
  narrationLang: string;
  durationSeconds: number | null;
  posterUrl: string | null;
  videoUrl: string;
  createdAt: string;
  approvalStatus: string;
  /** Published rows in video_content_links. */
  siteLinks: number;
  /** Distinct platforms with a published social post. */
  platforms: string[];
}

export type VideoFilter = "all" | "on_site" | "posted" | "unposted" | "pending_review";

export async function getDashboardVideos(filter: VideoFilter = "all", limit = 12): Promise<DashboardVideo[]> {
  if (!sql) return [];

  // One pass with two correlated aggregates rather than N+1 lookups per render: the dashboard
  // shows a dozen rows and this is the page's slowest query if it fans out.
  const rows = (await sql`
    WITH v AS (
      SELECT r.id AS render_id, r.project_id, r.format, r.narration_lang, r.duration_seconds,
             r.poster_url, r.video_url, r.created_at, r.approval_status,
             p.title AS project_title, p.status AS project_status,
             (SELECT COUNT(*)::int FROM video_content_links l
               WHERE l.render_id = r.id AND l.is_published) AS site_links,
             COALESCE((
               SELECT ARRAY_AGG(DISTINCT sv.platform)
               FROM social_posts sp
               JOIN social_variants sv ON sv.id = sp.variant_id
               JOIN social_briefs sb ON sb.id = sv.brief_id
               WHERE sb.render_id = r.id AND sp.status = 'published'
             ), ARRAY[]::text[]) AS platforms
      FROM video_renders r
      JOIN video_projects p ON p.id = r.project_id
      WHERE r.is_current AND r.approval_status <> 'rejected'
    )
    SELECT * FROM v
    WHERE CASE
      WHEN ${filter} = 'on_site'        THEN site_links > 0
      WHEN ${filter} = 'posted'         THEN cardinality(platforms) > 0
      WHEN ${filter} = 'unposted'       THEN site_links = 0 AND cardinality(platforms) = 0
      WHEN ${filter} = 'pending_review' THEN approval_status = 'pending_review'
      ELSE TRUE
    END
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    renderId: String(r.render_id),
    projectId: String(r.project_id),
    projectTitle: String(r.project_title),
    projectStatus: String(r.project_status),
    format: String(r.format),
    narrationLang: String(r.narration_lang),
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    posterUrl: (r.poster_url as string | null) ?? null,
    videoUrl: String(r.video_url),
    createdAt: String(r.created_at),
    approvalStatus: String(r.approval_status),
    siteLinks: Number(r.site_links),
    platforms: (r.platforms as string[]) ?? [],
  }));
}

/** Counts for the filter pills, so a filter that would show nothing says so before you click. */
export async function getVideoFilterCounts(): Promise<Record<VideoFilter, number>> {
  const empty: Record<VideoFilter, number> = { all: 0, on_site: 0, posted: 0, unposted: 0, pending_review: 0 };
  if (!sql) return empty;

  const rows = (await sql`
    WITH v AS (
      SELECT r.id,
             r.approval_status,
             (SELECT COUNT(*)::int FROM video_content_links l
               WHERE l.render_id = r.id AND l.is_published) AS site_links,
             (SELECT COUNT(DISTINCT sv.platform)::int
               FROM social_posts sp
               JOIN social_variants sv ON sv.id = sp.variant_id
               JOIN social_briefs sb ON sb.id = sv.brief_id
               WHERE sb.render_id = r.id AND sp.status = 'published') AS posted
      FROM video_renders r
      WHERE r.is_current AND r.approval_status <> 'rejected'
    )
    SELECT COUNT(*)::int AS all,
           COUNT(*) FILTER (WHERE site_links > 0)::int AS on_site,
           COUNT(*) FILTER (WHERE posted > 0)::int AS posted,
           COUNT(*) FILTER (WHERE site_links = 0 AND posted = 0)::int AS unposted,
           COUNT(*) FILTER (WHERE approval_status = 'pending_review')::int AS pending_review
    FROM v
  `) as Record<string, unknown>[];

  const r = rows[0];
  if (!r) return empty;
  return {
    all: Number(r.all),
    on_site: Number(r.on_site),
    posted: Number(r.posted),
    unposted: Number(r.unposted),
    pending_review: Number(r.pending_review),
  };
}
