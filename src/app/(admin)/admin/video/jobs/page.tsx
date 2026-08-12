import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { JobMonitor } from "./JobMonitor";

export const dynamic = "force-dynamic";

export default async function VideoJobsPage() {
  let workerSeenAt: string | null = null;
  let activeCount = 0;

  if (sql) {
    const [worker, active] = await Promise.all([
      sql`SELECT MAX(heartbeat_at)::text AS seen FROM video_render_jobs` as Promise<{ seen: string | null }[]>,
      sql`SELECT COUNT(*)::int AS count FROM video_render_jobs WHERE status IN ('queued','claimed','running')` as Promise<
        { count: number }[]
      >,
    ]);
    workerSeenAt = worker[0]?.seen ?? null;
    activeCount = active[0]?.count ?? 0;
  }

  return (
    <div>
      <AdminPageHeader
        title="Render queue"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Render queue" },
        ]}
      />

      <AdminCard className="mb-6">
        <p className="text-sm text-charcoal font-semibold mb-1">Where rendering happens</p>
        <p className="text-sm text-secondary">
          Rendering needs a headless browser and ffmpeg, so it cannot run on Netlify. Jobs sit in this queue until a
          worker claims them — either <code className="bg-base px-1 rounded">npm run video:worker</code> on your Mac, or
          the GitHub Actions workflow. Last worker heartbeat:{" "}
          <strong className="text-charcoal">
            {workerSeenAt ? new Date(workerSeenAt).toLocaleString() : "never"}
          </strong>
          {activeCount > 0 ? ` · ${activeCount} job${activeCount === 1 ? "" : "s"} waiting.` : "."}
        </p>
      </AdminCard>

      {!sql ? <AdminEmptyState message="Database unavailable." /> : <JobMonitor />}
    </div>
  );
}
