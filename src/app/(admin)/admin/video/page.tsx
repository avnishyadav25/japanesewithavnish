import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

type ProjectRow = { id: string; title: string; status: string; scope_kind: string; formats: string[]; created_at: string };
type CountRow = { count: number };
type SpendRow = { llm: number | null; tts: number | null };

export default async function VideoStudioDashboard() {
  let recent: ProjectRow[] = [];
  let queueDepth = 0;
  let inFlight = 0;
  let failed = 0;
  let rendersThisWeek = 0;
  let spend: SpendRow = { llm: 0, tts: 0 };
  let workerSeenAt: string | null = null;

  if (sql) {
    const [projects, queued, running, failedJobs, weekRenders, costs, worker] = await Promise.all([
      sql`SELECT id, title, status, scope_kind, formats, created_at::text AS created_at
          FROM video_projects ORDER BY created_at DESC LIMIT 8` as Promise<ProjectRow[]>,
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

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Recent projects</h2>
      {recent.length === 0 ? (
        <AdminEmptyState
          message="No video projects yet. Start with a batch of vocabulary — it is the fastest way to see the whole pipeline work."
          action={{ label: "New video", href: "/admin/video/new" }}
        />
      ) : (
        <AdminCard>
          <AdminTable headers={["Title", "Scope", "Formats", "Status", "Created"]}>
            {recent.map((project) => (
              <tr key={project.id} className="border-b border-[var(--divider)] last:border-0">
                <td className="py-3 px-2">
                  <Link href={`/admin/video/projects/${project.id}`} className="text-primary hover:underline font-medium">
                    {project.title}
                  </Link>
                </td>
                <td className="py-3 px-2 text-secondary">{project.scope_kind.replace(/_/g, " ")}</td>
                <td className="py-3 px-2 text-secondary">{(project.formats ?? []).join(", ")}</td>
                <td className="py-3 px-2">
                  <StatusBadge status={project.status} />
                </td>
                <td className="py-3 px-2 text-secondary">{new Date(project.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      )}
    </div>
  );
}
