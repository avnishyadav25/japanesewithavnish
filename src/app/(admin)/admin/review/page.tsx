import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BulkRunReviewForm } from "./BulkRunReviewForm";
import {
  getCoverageMatrix,
  getAgentAnalytics,
  getReviewerAnalytics,
  getCostSummary,
  getPerformanceCorrelation,
  getIssuesByContentType,
  getReviewTrend30Days,
  getAvgResolutionTimeHours,
  getCommonIssueCategories,
} from "@/lib/contentReview/dashboardQueries";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";
import { getCompleteListeningPostIds } from "@/lib/learn/listeningPublishGate";
import { SimpleBarChart, TrendSparkline } from "./SimpleBarChart";

type ReviewStateCount = { review_state: string; count: number };
type SeverityCount = { severity: string; count: number };
type RecentRun = {
  id: string;
  entity_type: string;
  entity_id: string;
  overall_status: string;
  overall_score: number | null;
  created_at: string;
  slug: string | null;
  title: string | null;
};

export default async function ReviewDashboardPage() {
  let reviewStateCounts: ReviewStateCount[] = [];
  let openSeverityCounts: SeverityCount[] = [];
  let recentRuns: RecentRun[] = [];

  let coverage: Awaited<ReturnType<typeof getCoverageMatrix>> = [];
  let agentAnalytics: Awaited<ReturnType<typeof getAgentAnalytics>> = [];
  let reviewerAnalytics: Awaited<ReturnType<typeof getReviewerAnalytics>> = [];
  let costSummary: Awaited<ReturnType<typeof getCostSummary>> | null = null;
  let performance: Awaited<ReturnType<typeof getPerformanceCorrelation>> = [];

  // Gap-fix phase 13: the 5 previously-missing dashboard tiles.
  let openLearnerReports = 0;
  let readyToPublish = 0;
  let avgQualityScore: number | null = null;
  let practiceCompletePct: number | null = null;

  // Gap-fix phase 14: the 4 previously-missing charts/stats.
  let issuesByType: Awaited<ReturnType<typeof getIssuesByContentType>> = [];
  let reviewTrend: Awaited<ReturnType<typeof getReviewTrend30Days>> = [];
  let avgResolutionHours: number | null = null;
  let commonCategories: Awaited<ReturnType<typeof getCommonIssueCategories>> = [];

  if (sql) {
    let grammarPracticeRow: { total: number; complete: number };
    let listeningTotal: number;
    let listeningCompleteIds: Set<string>;

    [
      reviewStateCounts,
      openSeverityCounts,
      recentRuns,
      coverage,
      agentAnalytics,
      reviewerAnalytics,
      costSummary,
      performance,
      openLearnerReports,
      readyToPublish,
      avgQualityScore,
      grammarPracticeRow,
      listeningTotal,
      listeningCompleteIds,
      issuesByType,
      reviewTrend,
      avgResolutionHours,
      commonCategories,
    ] = await Promise.all([
      sql`
        SELECT review_state, COUNT(*)::int AS count FROM posts
        GROUP BY review_state ORDER BY review_state
      ` as unknown as Promise<ReviewStateCount[]>,
      // Scoped to each post's CURRENT run only (via last_review_run_id) — a post re-reviewed
      // multiple times (e.g. by Scheduled Re-review) leaves its earlier runs' findings with
      // status='open' forever since nothing resolves them; counting every run ever would
      // make this tile grow independent of the site's actual current state.
      sql`
        SELECT f.severity, COUNT(*)::int AS count
        FROM content_review_findings f
        JOIN posts p ON p.last_review_run_id = f.review_run_id
        WHERE f.status = 'open'
        GROUP BY f.severity
      ` as unknown as Promise<SeverityCount[]>,
      sql`
        SELECT r.id, r.entity_type, r.entity_id, r.overall_status, r.overall_score, r.created_at,
               p.slug, p.title
        FROM content_review_runs r
        LEFT JOIN posts p ON p.id = r.entity_id
        ORDER BY r.created_at DESC
        LIMIT 20
      ` as unknown as Promise<RecentRun[]>,
      getCoverageMatrix(),
      getAgentAnalytics(),
      getReviewerAnalytics(),
      getCostSummary(),
      getPerformanceCorrelation(),
      sql`SELECT COUNT(*)::int AS count FROM learner_content_reports WHERE status IN ('new', 'triaged')`.then(
        (rows) => (rows as { count: number }[])[0]?.count ?? 0
      ),
      // "Ready to publish" = a human has approved it but it isn't live yet — review_state
      // reaches 'approved' via the Queue's bulk-action Approve button; 'publish_ready' is a
      // defined state in the enum that no code path actually transitions into.
      sql`SELECT COUNT(*)::int AS count FROM posts WHERE review_state = 'approved' AND status <> 'published'`.then(
        (rows) => (rows as { count: number }[])[0]?.count ?? 0
      ),
      sql`
        SELECT AVG(r.overall_score)::float AS avg_score
        FROM posts p JOIN content_review_runs r ON r.id = p.last_review_run_id
        WHERE r.overall_score IS NOT NULL
      `.then((rows) => (rows as { avg_score: number | null }[])[0]?.avg_score ?? null),
      sql`
        SELECT COUNT(DISTINCT p.id)::int AS total,
               COUNT(DISTINCT p.id) FILTER (WHERE EXISTS (SELECT 1 FROM grammar_drill_items gdi WHERE gdi.grammar_id = g.id))::int AS complete
        FROM posts p JOIN grammar g ON g.post_id = p.id
        WHERE p.content_type = 'grammar'
      `.then((rows) => (rows as { total: number; complete: number }[])[0] ?? { total: 0, complete: 0 }),
      sql`SELECT COUNT(*)::int AS count FROM posts WHERE content_type = 'listening'`.then((rows) => (rows as { count: number }[])[0]?.count ?? 0),
      getCompleteListeningPostIds(),
      getIssuesByContentType(),
      getReviewTrend30Days(),
      getAvgResolutionTimeHours(),
      getCommonIssueCategories(),
    ]);

    const practiceTotal = grammarPracticeRow.total + listeningTotal;
    const practiceComplete = grammarPracticeRow.complete + listeningCompleteIds.size;
    practiceCompletePct = practiceTotal > 0 ? Math.round((practiceComplete / practiceTotal) * 100) : null;
  }

  const totalPosts = reviewStateCounts.reduce((sum, r) => sum + r.count, 0);
  const needsHumanReview = reviewStateCounts.find((r) => r.review_state === "needs_human_review")?.count ?? 0;
  const notReviewed = reviewStateCounts.find((r) => r.review_state === "not_reviewed")?.count ?? 0;
  const validationFailed = reviewStateCounts.find((r) => r.review_state === "validation_failed")?.count ?? 0;
  const criticalOpen = openSeverityCounts.find((s) => s.severity === "critical")?.count ?? 0;
  const majorOpen = openSeverityCounts.find((s) => s.severity === "major")?.count ?? 0;
  const humanReviewCoveragePct = totalPosts > 0 ? Math.round(((totalPosts - notReviewed) / totalPosts) * 100) : null;

  return (
    <div>
      <AdminPageHeader
        title="Content Review"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        action={{ label: "Open Review Queue", href: "/admin/review/queue" }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Total content</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{totalPosts}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Never reviewed</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{notReviewed}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Needs human review</p>
          <p className="font-heading text-2xl font-bold text-primary">{needsHumanReview}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Validation failed</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{validationFailed}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Open critical findings</p>
          <p className="font-heading text-2xl font-bold text-red-600">{criticalOpen}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Open major findings</p>
          <p className="font-heading text-2xl font-bold text-amber-600">{majorOpen}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Learner-reported issues</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{openLearnerReports}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Ready to publish</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{readyToPublish}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Avg. quality score</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{avgQualityScore != null ? Math.round(avgQualityScore) : "—"}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Practice/audio complete</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{practiceCompletePct != null ? `${practiceCompletePct}%` : "—"}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Human-review coverage</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{humanReviewCoveragePct != null ? `${humanReviewCoveragePct}%` : "—"}</p>
        </AdminCard>
      </div>

      <AdminCard className="mb-8">
        <BulkRunReviewForm />
      </AdminCard>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Content by review state</h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {reviewStateCounts.map((r) => (
          <Link
            key={r.review_state}
            href={`/admin/review/queue?review_state=${r.review_state}`}
            className="px-3 py-1.5 rounded-bento text-sm font-medium bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition inline-flex items-center gap-2"
          >
            <StatusBadge status={r.review_state} />
            <span>{r.count}</span>
          </Link>
        ))}
      </div>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Coverage matrix</h2>
      <AdminCard className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--divider)]">
                <th className="text-left py-2 px-2 font-semibold text-charcoal">Level</th>
                {REVIEW_ENTITY_TYPES.map((t) => (
                  <th key={t} className="text-left py-2 px-2 font-semibold text-charcoal">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["N5", "N4", "N3", "N2", "N1"].map((level) => (
                <tr key={level} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-medium text-charcoal">{level}</td>
                  {REVIEW_ENTITY_TYPES.map((t) => {
                    const cell = coverage.find((c) => c.level === level && c.contentType === t);
                    if (!cell || cell.total === 0) return <td key={t} className="py-2 px-2 text-secondary">—</td>;
                    return (
                      <td key={t} className="py-2 px-2 text-charcoal">
                        {cell.reviewed}/{cell.total}
                        {cell.avgScore != null && <span className="text-secondary text-xs"> (avg {Math.round(cell.avgScore)})</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Open issues by content type</h2>
          <AdminCard>
            <SimpleBarChart
              rows={issuesByType.map((r) => ({ label: r.contentType, count: r.count }))}
              emptyMessage="No open findings right now."
            />
          </AdminCard>
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Most common issue categories</h2>
          <AdminCard>
            <SimpleBarChart
              rows={commonCategories.map((r) => ({ label: r.category, count: r.count }))}
              emptyMessage="No findings recorded yet."
            />
          </AdminCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Review runs, last 30 days</h2>
          <AdminCard>
            <TrendSparkline days={reviewTrend} />
          </AdminCard>
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Avg. finding resolution time</h2>
          <AdminCard>
            <p className="font-heading text-2xl font-bold text-charcoal">
              {avgResolutionHours != null
                ? avgResolutionHours < 1
                  ? `${Math.round(avgResolutionHours * 60)} min`
                  : avgResolutionHours < 48
                    ? `${avgResolutionHours.toFixed(1)} hrs`
                    : `${(avgResolutionHours / 24).toFixed(1)} days`
                : "—"}
            </p>
            <p className="text-xs text-secondary mt-1">Time from a finding appearing to a human deciding on it (excludes automated Apply Fix decisions).</p>
          </AdminCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Agent analytics</h2>
          {agentAnalytics.length > 0 ? (
            <AdminCard>
              <AdminTable headers={["Agent", "Findings", "Accepted", "Fixed", "Rejected", "False +"]}>
                {agentAnalytics.map((a) => (
                  <tr key={a.agentKey} className="border-b border-[var(--divider)]">
                    <td className="py-2 px-2 text-charcoal text-sm">{a.agentKey}</td>
                    <td className="py-2 px-2 text-charcoal">{a.totalFindings}</td>
                    <td className="py-2 px-2 text-secondary">{a.accepted}</td>
                    <td className="py-2 px-2 text-secondary">{a.fixed}</td>
                    <td className="py-2 px-2 text-secondary">{a.rejected}</td>
                    <td className="py-2 px-2 text-secondary">{a.falsePositive}</td>
                  </tr>
                ))}
              </AdminTable>
            </AdminCard>
          ) : (
            <p className="text-secondary text-sm">No findings recorded yet.</p>
          )}
        </div>

        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Reviewer calibration</h2>
          {reviewerAnalytics.length > 0 ? (
            <AdminCard>
              <AdminTable headers={["Reviewer", "Decisions", "Accepted", "Fixed", "Rejected", "False +"]}>
                {reviewerAnalytics.map((r) => (
                  <tr key={r.decidedBy} className="border-b border-[var(--divider)]">
                    <td className="py-2 px-2 text-charcoal text-sm">{r.decidedBy}</td>
                    <td className="py-2 px-2 text-charcoal">{r.totalDecisions}</td>
                    <td className="py-2 px-2 text-secondary">{r.accepted}</td>
                    <td className="py-2 px-2 text-secondary">{r.fixed}</td>
                    <td className="py-2 px-2 text-secondary">{r.rejected}</td>
                    <td className="py-2 px-2 text-secondary">{r.falsePositive}</td>
                  </tr>
                ))}
              </AdminTable>
            </AdminCard>
          ) : (
            <p className="text-secondary text-sm">No human decisions recorded yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Cost</h2>
          <AdminCard>
            {costSummary && costSummary.totalRuns > 0 ? (
              <>
                <p className="text-sm text-secondary">
                  {costSummary.totalRuns} run(s) tracked · {(costSummary.totalPromptTokens + costSummary.totalCompletionTokens).toLocaleString()} tokens total
                </p>
                <p className="font-heading text-2xl font-bold text-charcoal mt-1">${costSummary.totalCostUsd.toFixed(4)}</p>
                <p className="text-xs text-secondary mt-1">${costSummary.last30DaysCostUsd.toFixed(4)} in the last 30 days · estimate, not billing truth</p>
              </>
            ) : (
              <p className="text-secondary text-sm">No cost data yet (only runs since this update are tracked).</p>
            )}
          </AdminCard>
        </div>

        <div>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">
            Score vs. learner completion
          </h2>
          {performance.length > 0 ? (
            <AdminCard>
              <AdminTable headers={["Score range", "Items", "Avg. learned rate"]}>
                {performance.map((p) => (
                  <tr key={p.bucket} className="border-b border-[var(--divider)]">
                    <td className="py-2 px-2 text-charcoal">{p.bucket}</td>
                    <td className="py-2 px-2 text-secondary">{p.itemCount}</td>
                    <td className="py-2 px-2 text-secondary">{p.avgLearnedRate != null ? `${Math.round(p.avgLearnedRate * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </AdminTable>
              <p className="text-xs text-secondary mt-2 px-2">
                Based on user_learning_progress (viewed→learned), not page-view analytics — content_events isn&apos;t tracked for Learn pages.
              </p>
            </AdminCard>
          ) : (
            <p className="text-secondary text-sm">Not enough reviewed content with learner progress data yet.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-bold text-charcoal">Recent review runs</h2>
        <Link href="/admin/review/runs" className="text-primary text-sm hover:underline">
          View all runs (full history) →
        </Link>
      </div>
      {recentRuns.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Content", "Type", "Status", "Score", "Date", "Actions"]}>
            {recentRuns.map((r) => (
              <tr key={r.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{r.title ?? r.entity_id}</td>
                <td className="py-2 px-2 text-secondary text-sm">{r.entity_type}</td>
                <td className="py-2 px-2">
                  <StatusBadge status={r.overall_status} />
                </td>
                <td className="py-2 px-2 text-charcoal">{r.overall_score ?? "—"}</td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 px-2">
                  <Link href={`/admin/review/${r.entity_type}/${r.entity_id}`} className="text-primary text-sm hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No review runs yet — trigger one from the Review Queue." />
      )}
    </div>
  );
}
