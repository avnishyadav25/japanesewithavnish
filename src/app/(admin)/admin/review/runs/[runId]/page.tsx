import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";

type RunRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  overall_status: string;
  overall_score: number | null;
  publish_ready: boolean;
  agent_keys_run: string[] | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
  duplicate_groups: string[][] | null;
  total_prompt_tokens: number | null;
  total_completion_tokens: number | null;
  estimated_cost_usd: string | null;
  content_checksum: string;
};

type FindingRow = {
  id: string;
  agent_key: string;
  severity: string;
  category: string;
  field_name: string | null;
  title: string;
  description: string;
  status: string;
};

export default async function ReviewRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!sql) notFound();

  const runRows = (await sql`
    SELECT r.id, r.entity_type, r.entity_id, r.overall_status, r.overall_score, r.publish_ready,
           r.agent_keys_run, r.summary, r.created_at, r.completed_at, r.duplicate_groups,
           r.total_prompt_tokens, r.total_completion_tokens, r.estimated_cost_usd, r.content_checksum
    FROM content_review_runs r WHERE r.id = ${runId}
  `) as RunRow[];
  const run = runRows[0];
  if (!run) notFound();

  const [postRows, findings] = (await Promise.all([
    sql`SELECT title, slug, last_review_run_id FROM posts WHERE id = ${run.entity_id}`,
    sql`
      SELECT id, agent_key, severity, category, field_name, title, description, status
      FROM content_review_findings WHERE review_run_id = ${runId}
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 WHEN 'suggestion' THEN 3 ELSE 4 END
    `,
  ])) as unknown as [{ title: string; slug: string; last_review_run_id: string | null }[], FindingRow[]];
  const post = postRows[0];
  const isCurrent = post?.last_review_run_id === run.id;

  return (
    <div>
      <AdminPageHeader
        title={post?.title ?? run.entity_id}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Content Review", href: "/admin/review" },
          { label: "AI Review Runs", href: "/admin/review/runs" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-secondary text-sm">{run.entity_type}</span>
        <StatusBadge status={run.overall_status} />
        {run.overall_score != null && <span className="text-charcoal text-sm font-medium">Score: {run.overall_score}</span>}
        <span className={`text-xs px-2 py-0.5 rounded ${isCurrent ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-base border border-[var(--divider)] text-secondary"}`}>
          {isCurrent ? "current run" : "superseded — a newer run exists"}
        </span>
      </div>

      {run.summary && (
        <AdminCard className="mb-6">
          <p className="text-sm text-secondary uppercase tracking-wider mb-1">Reviewer summary</p>
          <p className="text-charcoal">{run.summary}</p>
          <p className="text-xs text-secondary mt-2">
            Agents run: {(run.agent_keys_run ?? []).join(", ") || "—"} · Checksum: <code className="bg-base px-1 rounded">{run.content_checksum.slice(0, 12)}</code>
            {run.estimated_cost_usd != null && (
              <> · {(run.total_prompt_tokens ?? 0) + (run.total_completion_tokens ?? 0)} tokens (~${Number(run.estimated_cost_usd).toFixed(5)})</>
            )}
          </p>
        </AdminCard>
      )}

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Findings ({findings.length}) — read-only historical view</h2>
      {findings.length > 0 ? (
        findings.map((f) => (
          <div key={f.id} className="border border-[var(--divider)] rounded-bento p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={f.severity} />
              <span className="text-xs text-secondary uppercase tracking-wider">{f.category}</span>
              <span className="text-xs text-secondary">· {f.agent_key}</span>
              <span className="ml-auto">
                <StatusBadge status={f.status} />
              </span>
            </div>
            <p className="font-medium text-charcoal mb-1">{f.title}</p>
            <p className="text-sm text-secondary">{f.description}</p>
          </div>
        ))
      ) : (
        <p className="text-secondary text-sm mb-6">No findings on this run.</p>
      )}

      <p className="text-xs text-secondary mt-6">
        {isCurrent && post ? (
          <Link href={`/admin/review/${run.entity_type}/${run.entity_id}`} className="hover:text-primary transition">
            → Open the live Review Detail page to act on these findings
          </Link>
        ) : (
          <Link href={`/admin/review/${run.entity_type}/${run.entity_id}`} className="hover:text-primary transition">
            → View this content's current review state
          </Link>
        )}
      </p>
    </div>
  );
}
