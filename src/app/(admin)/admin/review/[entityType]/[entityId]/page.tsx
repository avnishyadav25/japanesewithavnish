import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { isReviewEntityType } from "@/lib/contentReview/types";
import { ReviewDetailClient } from "./ReviewDetailClient";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  jlpt_level: string[] | null;
  review_state: string;
  last_review_run_id: string | null;
};

type RunRow = {
  id: string;
  overall_status: string;
  overall_score: number | null;
  publish_ready: boolean;
  agent_keys_run: string[] | null;
  summary: string | null;
  created_at: string;
  duplicate_groups: string[][] | null;
  total_prompt_tokens: number | null;
  total_completion_tokens: number | null;
  estimated_cost_usd: string | null;
  category_scores: Record<string, number> | null;
};

type FindingRow = {
  id: string;
  agent_key: string;
  severity: string;
  category: string;
  field_name: string | null;
  original_value: unknown;
  suggested_value: unknown;
  title: string;
  description: string;
  status: string;
  why_it_matters: string | null;
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ entityType: string; entityId: string }>;
}) {
  const { entityType, entityId } = await params;
  if (!isReviewEntityType(entityType) || !sql) notFound();

  const postRows = (await sql`
    SELECT id, slug, title, content_type, jlpt_level, review_state, last_review_run_id
    FROM posts WHERE id = ${entityId} AND content_type = ${entityType}
    LIMIT 1
  `) as PostRow[];
  const post = postRows[0];
  if (!post) notFound();

  const runRows = post.last_review_run_id
    ? ((await sql`
        SELECT id, overall_status, overall_score, publish_ready, agent_keys_run, summary, created_at,
               duplicate_groups, total_prompt_tokens, total_completion_tokens, estimated_cost_usd, category_scores
        FROM content_review_runs WHERE id = ${post.last_review_run_id}
      `) as RunRow[])
    : [];
  const run = runRows[0] ?? null;

  const findings = run
    ? ((await sql`
        SELECT id, agent_key, severity, category, field_name, original_value, suggested_value, title, description, status, why_it_matters
        FROM content_review_findings WHERE review_run_id = ${run.id}
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 WHEN 'suggestion' THEN 3 ELSE 4 END,
          created_at ASC
      `) as FindingRow[])
    : [];

  return (
    <div>
      <AdminPageHeader
        title={post.title}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Content Review", href: "/admin/review" },
          { label: "Queue", href: "/admin/review/queue" },
        ]}
        actions={[
          { label: "Preview", href: `/learn/${entityType}/${post.slug}` },
          { label: "Edit content", href: `/admin/learn/${entityType}/${post.slug}/edit` },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-secondary text-sm">{entityType}</span>
        <span className="text-secondary text-sm">•</span>
        <span className="text-secondary text-sm">{post.jlpt_level?.[0] ?? "no level"}</span>
        <StatusBadge status={post.review_state} />
        {run?.overall_score != null && (
          <span className="text-charcoal text-sm font-medium">Score: {run.overall_score}</span>
        )}
      </div>

      {run?.summary && (
        <AdminCard className="mb-6">
          <p className="text-sm text-secondary uppercase tracking-wider mb-1">Reviewer summary</p>
          <p className="text-charcoal">{run.summary}</p>
          {run.estimated_cost_usd != null && (
            <p className="text-xs text-secondary mt-2">
              This run used {(run.total_prompt_tokens ?? 0) + (run.total_completion_tokens ?? 0)} tokens (~$
              {Number(run.estimated_cost_usd).toFixed(5)})
            </p>
          )}
        </AdminCard>
      )}

      <ReviewDetailClient
        entityType={entityType}
        entityId={post.id}
        reviewState={post.review_state}
        findings={findings}
        duplicateGroups={run?.duplicate_groups ?? []}
        categoryScores={run?.category_scores ?? null}
      />

      <p className="text-xs text-secondary mt-6">
        <Link href="/admin/review/queue" className="hover:text-primary transition">
          ← Back to Review Queue
        </Link>
      </p>
    </div>
  );
}
