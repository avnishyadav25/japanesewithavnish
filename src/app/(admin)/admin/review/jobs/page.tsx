import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { JobsTableClient } from "./JobsTableClient";

type JobRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  trigger_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  error_message: string | null;
  requested_by: string | null;
  created_at: string;
  title: string | null;
};

/** Gap-fix phase 23. Jobs were previously invisible in the UI beyond polling one at a time
 * from the Detail page — this surfaces the whole queue (queued/claimed/running first, recent
 * terminal jobs below) and lets an admin cancel a still-queued job. */
export default async function ReviewJobsPage() {
  let jobs: JobRow[] = [];
  if (sql) {
    jobs = (await sql`
      SELECT j.id, j.entity_type, j.entity_id, j.trigger_type, j.status, j.attempt_count, j.max_attempts,
             j.error_message, j.requested_by, j.created_at::text AS created_at, p.title
      FROM content_review_jobs j
      LEFT JOIN posts p ON p.id = j.entity_id
      ORDER BY
        CASE j.status WHEN 'queued' THEN 0 WHEN 'claimed' THEN 0 WHEN 'running' THEN 0 ELSE 1 END,
        j.created_at DESC
      LIMIT 200
    `) as JobRow[];
  }

  const active = jobs.filter((j) => ["queued", "claimed", "running"].includes(j.status));
  const recent = jobs.filter((j) => !["queued", "claimed", "running"].includes(j.status));

  return (
    <div>
      <AdminPageHeader title="Review Jobs" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Active ({active.length})</h2>
      {active.length > 0 ? (
        <AdminCard className="mb-8">
          <JobsTableClient jobs={active} showCancel />
        </AdminCard>
      ) : (
        <p className="text-secondary text-sm mb-8">No jobs currently queued, claimed, or running.</p>
      )}

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Recent (last 200)</h2>
      {recent.length > 0 ? (
        <AdminCard>
          <JobsTableClient jobs={recent} showCancel={false} />
        </AdminCard>
      ) : (
        <AdminEmptyState message="No completed/failed/cancelled jobs yet." />
      )}
    </div>
  );
}
