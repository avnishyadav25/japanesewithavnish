import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterPills } from "@/components/admin/FilterPills";
import { MaybeSocialIcon } from "@/components/icons/SocialIcons";
import { getDashboardVideos, getVideoFilterCounts, type VideoFilter } from "@/lib/video/dashboard";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  scope_kind: string;
  formats: string[];
  created_at: string;
  render_count: number;
};
type CountRow = { count: number };
type SpendRow = { llm: number | null; tts: number | null };

const VIDEO_FILTERS: VideoFilter[] = ["all", "unposted", "on_site", "posted", "pending_review"];

function isVideoFilter(v: string | undefined): v is VideoFilter {
  return VIDEO_FILTERS.includes(v as VideoFilter);
}

export default async function VideoStudioDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFilter = Array.isArray(params.videos) ? params.videos[0] : params.videos;
  const videoFilter: VideoFilter = isVideoFilter(rawFilter) ? rawFilter : "all";

  let recent: ProjectRow[] = [];
  let queueDepth = 0;
  let inFlight = 0;
  let failed = 0;
  let rendersThisWeek = 0;
  let spend: SpendRow = { llm: 0, tts: 0 };
  let workerSeenAt: string | null = null;

  if (sql) {
    const [projects, queued, running, failedJobs, weekRenders, costs, worker] = await Promise.all([
      // render_count and a full timestamp, because two same-day projects with the same auto-title
      // were otherwise indistinguishable here — which is how you open the empty twin of a
      // finished video.
      sql`SELECT p.id, p.title, p.status, p.scope_kind, p.formats, p.created_at::text AS created_at,
                 (SELECT COUNT(*)::int FROM video_renders r WHERE r.project_id = p.id AND r.is_current) AS render_count
          FROM video_projects p ORDER BY p.created_at DESC LIMIT 8` as Promise<ProjectRow[]>,
      sql`SELECT COUNT(*)::int AS count FROM video_render_jobs WHERE status = 'queued'` as Promise<CountRow[]>,
      sql`SELECT COUNT(*)::int AS count FROM video_render_jobs WHERE status IN ('claimed','running')` as Promise<CountRow[]>,
      sql`SELECT COUNT(*)::int AS count FROM video_render_jobs WHERE status = 'failed'` as Promise<CountRow[]>,
      sql`SELECT COUNT(*)::int AS count FROM video_renders WHERE created_at > NOW() - INTERVAL '7 days'` as Promise<CountRow[]>,
      sql`SELECT
            (SELECT COALESCE(SUM(estimated_cost_usd), 0)::float FROM video_storyboards
              WHERE created_at > NOW() - INTERVAL '30 days') AS llm,
            (SELECT COALESCE(SUM(estimated_cost_usd), 0)::float FROM video_tts_assets
              WHERE created_at > NOW() - INTERVAL '30 days') AS tts` as Promise<SpendRow[]>,
      // Last heartbeat from any runner — the fastest way to answer "is a worker actually up?",
      // which is the first question when nothing is progressing.
      sql`SELECT MAX(heartbeat_at)::text AS seen FROM video_render_jobs` as Promise<{ seen: string | null }[]>,
    ]);

    recent = projects;
    queueDepth = queued[0]?.count ?? 0;
    inFlight = running[0]?.count ?? 0;
    failed = failedJobs[0]?.count ?? 0;
    rendersThisWeek = weekRenders[0]?.count ?? 0;
    spend = costs[0] ?? { llm: 0, tts: 0 };
    workerSeenAt = worker[0]?.seen ?? null;
  }

  // Distribution state. Loaded after the block above rather than inside it because both helpers
  // guard on `sql` themselves and return empty arrays when the database is down.
  const [videos, videoCounts] = await Promise.all([getDashboardVideos(videoFilter, 12), getVideoFilterCounts()]);

  const stats = [
    { label: "Queued", value: queueDepth, href: "/admin/video/jobs" },
    { label: "Rendering now", value: inFlight, href: "/admin/video/jobs" },
    { label: "Failed jobs", value: failed, href: "/admin/video/jobs" },
    { label: "Renders (7 days)", value: rendersThisWeek, href: "/admin/video/renders" },
  ];

  const totalSpend = (spend.llm ?? 0) + (spend.tts ?? 0);
  const workerAgeMinutes = workerSeenAt ? (Date.now() - new Date(workerSeenAt).getTime()) / 60000 : null;
  const workerLooksDown = (queueDepth > 0 || inFlight > 0) && (workerAgeMinutes === null || workerAgeMinutes > 5);

  return (
    <div>
      <AdminPageHeader
        title="Video Studio"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Video Studio" }]}
        actions={[
          { label: "Content plan", href: "/admin/video/content-plan" },
          { label: "New video", href: "/admin/video/new" },
        ]}
      />

      {workerLooksDown && (
        <AdminCard className="mb-6 border-l-4 border-amber-400">
          <p className="text-sm text-charcoal font-semibold mb-1">No render worker is responding</p>
          <p className="text-sm text-secondary">
            {queueDepth + inFlight} job{queueDepth + inFlight === 1 ? " is" : "s are"} waiting but no worker has sent a
            heartbeat{workerAgeMinutes !== null ? ` in ${Math.round(workerAgeMinutes)} minutes` : " yet"}. Start one
            locally with <code className="bg-base px-1 rounded">npm run video:worker</code>, or trigger the GitHub
            Actions workflow.
          </p>
        </AdminCard>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card-content hover:shadow-card-hover transition">
            <div className="text-secondary text-xs uppercase tracking-wider mb-1">{stat.label}</div>
            <div className="font-heading text-3xl font-bold text-charcoal">{stat.value}</div>
          </Link>
        ))}
      </div>

      <AdminCard className="mb-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="text-secondary text-xs uppercase tracking-wider mb-1">Generation spend, last 30 days</div>
            <div className="font-heading text-2xl font-bold text-charcoal">${totalSpend.toFixed(2)}</div>
          </div>
          <div className="text-sm text-secondary">
            Narration script (DeepSeek) ${(spend.llm ?? 0).toFixed(2)} · Voiceover (Google TTS) $
            {(spend.tts ?? 0).toFixed(2)}
          </div>
        </div>
      </AdminCard>

      {/* -------- Videos and where they went -------- */}
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <h2 className="font-heading text-lg font-bold text-charcoal">Videos</h2>
        <Link href="/admin/video/renders" className="text-sm text-primary hover:underline">
          All finished videos →
        </Link>
      </div>
      <div className="mb-4">
        <FilterPills
          basePath="/admin/video"
          param="videos"
          active={videoFilter === "all" ? undefined : videoFilter}
          options={[
            { label: "All", badge: videoCounts.all },
            { label: "Not shared", value: "unposted", badge: videoCounts.unposted },
            { label: "On site", value: "on_site", badge: videoCounts.on_site },
            { label: "On social", value: "posted", badge: videoCounts.posted },
            { label: "Needs review", value: "pending_review", badge: videoCounts.pending_review },
          ]}
        />
      </div>

      <AdminCard className="mb-8">
        {videos.length === 0 ? (
          <p className="text-sm text-secondary">
            {videoFilter === "all"
              ? "Nothing rendered yet."
              : "No videos match that filter."}
          </p>
        ) : (
          <>
            {/* "Not shared" is the number worth acting on: a rendered video nobody has seen is
                finished work earning nothing. An on-site embed is counted separately from social
                because they are different audiences — the same distinction the content plan makes. */}
            <AdminTable headers={["Video", "Format", "Length", "On site", "On social", "Rendered", ""]}>
              {videos.map((v) => (
                <tr key={v.renderId} className="border-b border-[var(--divider)] last:border-0">
                  <td className="py-3 px-2">
                    <Link href={`/admin/video/projects/${v.projectId}`} className="text-charcoal hover:underline font-medium">
                      {v.projectTitle}
                    </Link>
                    {v.approvalStatus === "pending_review" && (
                      <span className="ml-2">
                        <StatusBadge status="pending_review" />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-secondary whitespace-nowrap">
                    {v.format} · {v.narrationLang}
                  </td>
                  <td className="py-3 px-2 text-secondary tabular-nums">
                    {v.durationSeconds ? `${Math.round(v.durationSeconds)}s` : "—"}
                  </td>
                  <td className="py-3 px-2 text-secondary tabular-nums">{v.siteLinks > 0 ? v.siteLinks : "—"}</td>
                  <td className="py-3 px-2">
                    {v.platforms.length === 0 ? (
                      <span className="text-secondary">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {v.platforms.map((p) => (
                          <MaybeSocialIcon key={p} platform={p as never} className="w-3.5 h-3.5" />
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-secondary whitespace-nowrap">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap">
                    {v.siteLinks === 0 && v.platforms.length === 0 && (
                      <Link href={`/admin/social/briefs/new?renderId=${v.renderId}`} className="text-primary hover:underline">
                        Share
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </AdminTable>
          </>
        )}
      </AdminCard>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Recent projects</h2>
      {recent.length === 0 ? (
        <AdminEmptyState
          message="No video projects yet. Start with a batch of vocabulary — it is the fastest way to see the whole pipeline work."
          action={{ label: "New video", href: "/admin/video/new" }}
        />
      ) : (
        <AdminCard>
          <AdminTable headers={["Title", "Scope", "Formats", "Videos", "Status", "Created"]}>
            {recent.map((project) => (
              <tr key={project.id} className="border-b border-[var(--divider)] last:border-0">
                <td className="py-3 px-2">
                  <Link href={`/admin/video/projects/${project.id}`} className="text-primary hover:underline font-medium">
                    {project.title}
                  </Link>
                </td>
                <td className="py-3 px-2 text-secondary">{project.scope_kind.replace(/_/g, " ")}</td>
                <td className="py-3 px-2 text-secondary">{(project.formats ?? []).join(", ")}</td>
                <td className="py-3 px-2 text-secondary tabular-nums">{project.render_count || "—"}</td>
                <td className="py-3 px-2">
                  <StatusBadge status={project.status} />
                </td>
                {/* Time, not just the date: two projects created the same day with the same
                    auto-generated title were otherwise identical rows. */}
                <td className="py-3 px-2 text-secondary whitespace-nowrap">
                  {new Date(project.created_at).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      )}
    </div>
  );
}
