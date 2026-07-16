import { sql } from "@/lib/db";
import { REVIEW_ENTITY_TYPES } from "./types";

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export interface CoverageCell {
  level: string;
  contentType: string;
  total: number;
  reviewed: number;
  avgScore: number | null;
}

/** Phase 4 "Coverage matrix," reinterpreted for this system's posts-only scope (the
 * spec's original version was about curriculum objective coverage, out of scope per
 * decision #1) — level x content_type grid of review coverage and average score. */
export async function getCoverageMatrix(): Promise<CoverageCell[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT
      (jlpt_level)[1] AS level,
      content_type,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE review_state <> 'not_reviewed')::int AS reviewed,
      AVG(overall_score)::float AS avg_score
    FROM posts p
    LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
    WHERE content_type = ANY(${Array.from(REVIEW_ENTITY_TYPES)}) AND (jlpt_level)[1] = ANY(${JLPT_LEVELS})
    GROUP BY level, content_type
  `) as { level: string; content_type: string; total: number; reviewed: number; avg_score: number | null }[];

  return rows.map((r) => ({ level: r.level, contentType: r.content_type, total: r.total, reviewed: r.reviewed, avgScore: r.avg_score }));
}

export interface AgentOutcomeRow {
  agentKey: string;
  totalFindings: number;
  accepted: number;
  rejected: number;
  fixed: number;
  falsePositive: number;
}

/** Phase 3 "Agent analytics" — per-agent decision-outcome rates, computed from the existing
 * content_review_decisions table (no new schema needed). */
export async function getAgentAnalytics(): Promise<AgentOutcomeRow[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT
      f.agent_key,
      COUNT(*)::int AS total_findings,
      COUNT(*) FILTER (WHERE f.status = 'accepted')::int AS accepted,
      COUNT(*) FILTER (WHERE f.status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE f.status = 'fixed')::int AS fixed,
      COUNT(*) FILTER (WHERE f.status = 'false_positive')::int AS false_positive
    FROM content_review_findings f
    GROUP BY f.agent_key
    ORDER BY total_findings DESC
  `) as { agent_key: string; total_findings: number; accepted: number; rejected: number; fixed: number; false_positive: number }[];

  return rows.map((r) => ({
    agentKey: r.agent_key,
    totalFindings: r.total_findings,
    accepted: r.accepted,
    rejected: r.rejected,
    fixed: r.fixed,
    falsePositive: r.false_positive,
  }));
}

export interface ReviewerOutcomeRow {
  decidedBy: string;
  totalDecisions: number;
  accepted: number;
  rejected: number;
  fixed: number;
  falsePositive: number;
}

/** Phase 4 "Reviewer calibration" — per-reviewer decision patterns. Buildable without any
 * new RBAC: content_review_decisions.decided_by already records which admin email made each
 * call, so this is descriptive analytics only (no enforcement), unlike "Multi-reviewer
 * approval" which would need a real second-reviewer concept and stays deferred. */
export async function getReviewerAnalytics(): Promise<ReviewerOutcomeRow[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT
      decided_by,
      COUNT(*)::int AS total_decisions,
      COUNT(*) FILTER (WHERE decision = 'accept')::int AS accepted,
      COUNT(*) FILTER (WHERE decision = 'reject')::int AS rejected,
      COUNT(*) FILTER (WHERE decision = 'mark_fixed')::int AS fixed,
      COUNT(*) FILTER (WHERE decision = 'false_positive')::int AS false_positive
    FROM content_review_decisions
    WHERE decided_by <> 'system:apply-fix'
    GROUP BY decided_by
    ORDER BY total_decisions DESC
  `) as { decided_by: string; total_decisions: number; accepted: number; rejected: number; fixed: number; false_positive: number }[];

  return rows.map((r) => ({
    decidedBy: r.decided_by,
    totalDecisions: r.total_decisions,
    accepted: r.accepted,
    rejected: r.rejected,
    fixed: r.fixed,
    falsePositive: r.false_positive,
  }));
}

export interface CostSummary {
  totalRuns: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  last30DaysCostUsd: number;
}

/** Phase 3 "Cost analytics" — token usage was captured per run starting with this Phase
 * (see callReviewAgent.ts/jobRunner.ts); runs from before this change have NULL cost columns
 * and are correctly excluded by the SUM/COALESCE below rather than counted as zero-cost. */
export async function getCostSummary(): Promise<CostSummary> {
  if (!sql) return { totalRuns: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0, last30DaysCostUsd: 0 };
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE estimated_cost_usd IS NOT NULL)::int AS total_runs,
      COALESCE(SUM(total_prompt_tokens), 0)::int AS total_prompt_tokens,
      COALESCE(SUM(total_completion_tokens), 0)::int AS total_completion_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::float AS total_cost_usd,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0)::float AS last_30_days_cost_usd
    FROM content_review_runs
  `) as { total_runs: number; total_prompt_tokens: number; total_completion_tokens: number; total_cost_usd: number; last_30_days_cost_usd: number }[];

  const r = rows[0];
  return {
    totalRuns: r.total_runs,
    totalPromptTokens: r.total_prompt_tokens,
    totalCompletionTokens: r.total_completion_tokens,
    totalCostUsd: r.total_cost_usd,
    last30DaysCostUsd: r.last_30_days_cost_usd,
  };
}

export interface IssuesByTypeRow {
  contentType: string;
  count: number;
}

/** Gap-fix phase 14 chart 1: open findings by content type, current run only (same
 * last_review_run_id-scoping convention as the dashboard's open-findings tiles). */
export async function getIssuesByContentType(): Promise<IssuesByTypeRow[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT p.content_type, COUNT(*)::int AS count
    FROM content_review_findings f
    JOIN posts p ON p.last_review_run_id = f.review_run_id
    WHERE f.status = 'open'
    GROUP BY p.content_type
    ORDER BY count DESC
  `) as { content_type: string; count: number }[];
  return rows.map((r) => ({ contentType: r.content_type, count: r.count }));
}

export interface DailyRunCount {
  day: string;
  count: number;
}

/** Gap-fix phase 14 chart 2: review runs per day, last 30 days. Days with zero runs are
 * omitted by the query (not zero-filled) — the UI fills gaps so the trend reads correctly. */
export async function getReviewTrend30Days(): Promise<DailyRunCount[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT date_trunc('day', created_at)::date::text AS day, COUNT(*)::int AS count
    FROM content_review_runs
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day ASC
  `) as { day: string; count: number }[];
  return rows.map((r) => ({ day: r.day, count: r.count }));
}

/** Gap-fix phase 14 stat: average time from a finding being created to a human deciding on
 * it. Excludes 'system:apply-fix' decisions (an instant automated mark-fixed, not a real
 * triage-time signal) — same exclusion getReviewerAnalytics() already uses. */
export async function getAvgResolutionTimeHours(): Promise<number | null> {
  if (!sql) return null;
  const rows = (await sql`
    SELECT AVG(EXTRACT(EPOCH FROM (d.decided_at - f.created_at)))::float AS avg_seconds
    FROM content_review_decisions d
    JOIN content_review_findings f ON f.id = d.finding_id
    WHERE d.decided_by <> 'system:apply-fix'
  `) as { avg_seconds: number | null }[];
  const avgSeconds = rows[0]?.avg_seconds;
  return avgSeconds != null ? avgSeconds / 3600 : null;
}

export interface CategoryCount {
  category: string;
  count: number;
}

/** Gap-fix phase 14 chart 4: most common issue categories, all-time (not scoped to open/
 * current-run — this answers "what kinds of issues do agents tend to find," not a live count). */
export async function getCommonIssueCategories(limit = 10): Promise<CategoryCount[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT category, COUNT(*)::int AS count
    FROM content_review_findings
    GROUP BY category
    ORDER BY count DESC
    LIMIT ${limit}
  `) as { category: string; count: number }[];
  return rows.map((r) => ({ category: r.category, count: r.count }));
}

export interface PerformanceBucket {
  bucket: string;
  itemCount: number;
  avgLearnedRate: number | null;
}

/** Phase 4 "Content performance correlation." The spec's original data source
 * (content_events, page-view/duration analytics) turned out to be wired up only for
 * blog/product pages — never for Learn content — so it has no data for anything this
 * system reviews. Uses user_learning_progress instead (genuinely populated for Learn
 * content via "mark as learned"): for each reviewed post, the fraction of learners who
 * progressed from viewed to learned, bucketed by review score range. */
export async function getPerformanceCorrelation(): Promise<PerformanceBucket[]> {
  if (!sql) return [];
  const rows = (await sql`
    WITH scored AS (
      SELECT p.id, p.slug, r.overall_score,
        CASE
          WHEN r.overall_score >= 80 THEN '80-100'
          WHEN r.overall_score >= 50 THEN '50-79'
          ELSE '0-49'
        END AS bucket
      FROM posts p
      JOIN content_review_runs r ON r.id = p.last_review_run_id
      WHERE r.overall_score IS NOT NULL
    ),
    progress AS (
      SELECT content_slug,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'learned')::int AS learned
      FROM user_learning_progress
      GROUP BY content_slug
    )
    SELECT
      s.bucket,
      COUNT(DISTINCT s.id)::int AS item_count,
      AVG(CASE WHEN pr.total > 0 THEN pr.learned::float / pr.total ELSE NULL END) AS avg_learned_rate
    FROM scored s
    LEFT JOIN progress pr ON pr.content_slug = s.slug
    GROUP BY s.bucket
    ORDER BY s.bucket DESC
  `) as { bucket: string; item_count: number; avg_learned_rate: number | null }[];

  return rows.map((r) => ({ bucket: r.bucket, itemCount: r.item_count, avgLearnedRate: r.avg_learned_rate }));
}
