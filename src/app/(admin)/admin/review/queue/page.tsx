import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { REVIEW_ENTITY_TYPES, REVIEW_STATES, REVIEW_SEVERITIES } from "@/lib/contentReview/types";
import { QueueTableClient } from "./QueueTableClient";

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

type Row = {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  jlpt_level: string[] | null;
  review_state: string;
  overall_score: number | null;
  open_critical: number;
  open_major: number;
  updated_at: string;
  last_reviewer: string | null;
  has_learner_report: boolean;
};

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ content_type?: string; review_state?: string; jlpt_level?: string; sort?: string; severity?: string; learner_reported?: string }>;
}) {
  const sp = await searchParams;
  const contentTypeFilter = sp.content_type && (REVIEW_ENTITY_TYPES as readonly string[]).includes(sp.content_type) ? sp.content_type : null;
  const reviewStateFilter = sp.review_state && (REVIEW_STATES as readonly string[]).includes(sp.review_state) ? sp.review_state : null;
  const levelFilter = sp.jlpt_level && JLPT_LEVELS.includes(sp.jlpt_level) ? sp.jlpt_level : null;
  // Gap-fix phase 16: severity filter (posts with an open finding of this severity) and
  // learner-reported filter (posts with an open learner_content_reports entry).
  const severityFilter = sp.severity && (REVIEW_SEVERITIES as readonly string[]).includes(sp.severity) ? sp.severity : null;
  const learnerReportedFilter = sp.learner_reported === "1";
  // Phase 4 "Adaptive remediation": default is priority order (open critical/major counts,
  // then worst score first) rather than most-recently-touched — surfaces what needs fixing
  // most, not just what was edited last. ?sort=recent restores the old chronological view.
  const sortMode = sp.sort === "recent" ? "recent" : "priority";

  const contentTypes = contentTypeFilter ? [contentTypeFilter] : Array.from(REVIEW_ENTITY_TYPES);
  const reviewStates = reviewStateFilter ? [reviewStateFilter] : Array.from(REVIEW_STATES);

  let items: Row[] = [];
  if (sql) {
    const rows =
      sortMode === "priority"
        ? levelFilter
          ? await sql`
              SELECT p.id, p.slug, p.title, p.content_type, p.jlpt_level, p.review_state, p.updated_at,
                     r.overall_score,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'critical'), 0)::int AS open_critical,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'major'), 0)::int AS open_major,
                     (SELECT d.decided_by FROM content_review_decisions d JOIN content_review_findings f2 ON f2.id = d.finding_id WHERE f2.review_run_id = p.last_review_run_id ORDER BY d.decided_at DESC LIMIT 1) AS last_reviewer,
                     EXISTS (SELECT 1 FROM learner_content_reports lcr WHERE lcr.entity_id = p.id AND lcr.status IN ('new', 'triaged')) AS has_learner_report
              FROM posts p
              LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
              WHERE p.content_type = ANY(${contentTypes}) AND p.review_state = ANY(${reviewStates})
                AND ${levelFilter} = ANY(p.jlpt_level)
                AND (${severityFilter}::text IS NULL OR EXISTS (
                  SELECT 1 FROM content_review_findings f3 WHERE f3.review_run_id = p.last_review_run_id AND f3.status = 'open' AND f3.severity = ${severityFilter}
                ))
                AND (${learnerReportedFilter} IS NOT TRUE OR EXISTS (
                  SELECT 1 FROM learner_content_reports lcr2 WHERE lcr2.entity_id = p.id AND lcr2.status IN ('new', 'triaged')
                ))
              ORDER BY open_critical DESC, open_major DESC, overall_score ASC NULLS LAST, p.updated_at DESC
              LIMIT 200
            `
          : await sql`
              SELECT p.id, p.slug, p.title, p.content_type, p.jlpt_level, p.review_state, p.updated_at,
                     r.overall_score,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'critical'), 0)::int AS open_critical,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'major'), 0)::int AS open_major,
                     (SELECT d.decided_by FROM content_review_decisions d JOIN content_review_findings f2 ON f2.id = d.finding_id WHERE f2.review_run_id = p.last_review_run_id ORDER BY d.decided_at DESC LIMIT 1) AS last_reviewer,
                     EXISTS (SELECT 1 FROM learner_content_reports lcr WHERE lcr.entity_id = p.id AND lcr.status IN ('new', 'triaged')) AS has_learner_report
              FROM posts p
              LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
              WHERE p.content_type = ANY(${contentTypes}) AND p.review_state = ANY(${reviewStates})
                AND (${severityFilter}::text IS NULL OR EXISTS (
                  SELECT 1 FROM content_review_findings f3 WHERE f3.review_run_id = p.last_review_run_id AND f3.status = 'open' AND f3.severity = ${severityFilter}
                ))
                AND (${learnerReportedFilter} IS NOT TRUE OR EXISTS (
                  SELECT 1 FROM learner_content_reports lcr2 WHERE lcr2.entity_id = p.id AND lcr2.status IN ('new', 'triaged')
                ))
              ORDER BY open_critical DESC, open_major DESC, overall_score ASC NULLS LAST, p.updated_at DESC
              LIMIT 200
            `
        : levelFilter
          ? await sql`
              SELECT p.id, p.slug, p.title, p.content_type, p.jlpt_level, p.review_state, p.updated_at,
                     r.overall_score,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'critical'), 0)::int AS open_critical,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'major'), 0)::int AS open_major,
                     (SELECT d.decided_by FROM content_review_decisions d JOIN content_review_findings f2 ON f2.id = d.finding_id WHERE f2.review_run_id = p.last_review_run_id ORDER BY d.decided_at DESC LIMIT 1) AS last_reviewer,
                     EXISTS (SELECT 1 FROM learner_content_reports lcr WHERE lcr.entity_id = p.id AND lcr.status IN ('new', 'triaged')) AS has_learner_report
              FROM posts p
              LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
              WHERE p.content_type = ANY(${contentTypes}) AND p.review_state = ANY(${reviewStates})
                AND ${levelFilter} = ANY(p.jlpt_level)
                AND (${severityFilter}::text IS NULL OR EXISTS (
                  SELECT 1 FROM content_review_findings f3 WHERE f3.review_run_id = p.last_review_run_id AND f3.status = 'open' AND f3.severity = ${severityFilter}
                ))
                AND (${learnerReportedFilter} IS NOT TRUE OR EXISTS (
                  SELECT 1 FROM learner_content_reports lcr2 WHERE lcr2.entity_id = p.id AND lcr2.status IN ('new', 'triaged')
                ))
              ORDER BY p.updated_at DESC
              LIMIT 200
            `
          : await sql`
              SELECT p.id, p.slug, p.title, p.content_type, p.jlpt_level, p.review_state, p.updated_at,
                     r.overall_score,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'critical'), 0)::int AS open_critical,
                     COALESCE((SELECT COUNT(*) FROM content_review_findings f WHERE f.review_run_id = p.last_review_run_id AND f.status = 'open' AND f.severity = 'major'), 0)::int AS open_major,
                     (SELECT d.decided_by FROM content_review_decisions d JOIN content_review_findings f2 ON f2.id = d.finding_id WHERE f2.review_run_id = p.last_review_run_id ORDER BY d.decided_at DESC LIMIT 1) AS last_reviewer,
                     EXISTS (SELECT 1 FROM learner_content_reports lcr WHERE lcr.entity_id = p.id AND lcr.status IN ('new', 'triaged')) AS has_learner_report
              FROM posts p
              LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
              WHERE p.content_type = ANY(${contentTypes}) AND p.review_state = ANY(${reviewStates})
                AND (${severityFilter}::text IS NULL OR EXISTS (
                  SELECT 1 FROM content_review_findings f3 WHERE f3.review_run_id = p.last_review_run_id AND f3.status = 'open' AND f3.severity = ${severityFilter}
                ))
                AND (${learnerReportedFilter} IS NOT TRUE OR EXISTS (
                  SELECT 1 FROM learner_content_reports lcr2 WHERE lcr2.entity_id = p.id AND lcr2.status IN ('new', 'triaged')
                ))
              ORDER BY p.updated_at DESC
              LIMIT 200
            `;
    items = rows as Row[];
  }

  function pillHref(param: string, value: string | null) {
    const params = new URLSearchParams();
    if (contentTypeFilter && param !== "content_type") params.set("content_type", contentTypeFilter);
    if (reviewStateFilter && param !== "review_state") params.set("review_state", reviewStateFilter);
    if (levelFilter && param !== "jlpt_level") params.set("jlpt_level", levelFilter);
    if (sortMode !== "priority" && param !== "sort") params.set("sort", sortMode);
    if (severityFilter && param !== "severity") params.set("severity", severityFilter);
    if (learnerReportedFilter && param !== "learner_reported") params.set("learner_reported", "1");
    if (value) params.set(param, value);
    const qs = params.toString();
    return `/admin/review/queue${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <AdminPageHeader title="Review Queue" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Type:</span>
        <Link href={pillHref("content_type", null)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${!contentTypeFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          All
        </Link>
        {REVIEW_ENTITY_TYPES.map((t) => (
          <Link key={t} href={pillHref("content_type", t)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${contentTypeFilter === t ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
            {t}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Level:</span>
        <Link href={pillHref("jlpt_level", null)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${!levelFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          All
        </Link>
        {JLPT_LEVELS.map((l) => (
          <Link key={l} href={pillHref("jlpt_level", l)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${levelFilter === l ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
            {l}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Status:</span>
        <Link href={pillHref("review_state", null)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${!reviewStateFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          All
        </Link>
        {REVIEW_STATES.map((s) => (
          <Link key={s} href={pillHref("review_state", s)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${reviewStateFilter === s ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Severity:</span>
        <Link href={pillHref("severity", null)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${!severityFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          All
        </Link>
        {REVIEW_SEVERITIES.map((s) => (
          <Link key={s} href={pillHref("severity", s)} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${severityFilter === s ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Learner reports:</span>
        <Link
          href={learnerReportedFilter ? pillHref("learner_reported", null) : pillHref("learner_reported", "1")}
          className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${learnerReportedFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}
        >
          Has open learner report
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Sort:</span>
        <Link href={pillHref("sort", "priority")} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${sortMode === "priority" ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          Needs attention first
        </Link>
        <Link href={pillHref("sort", "recent")} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${sortMode === "recent" ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          Recently updated
        </Link>
      </div>

      {items.length > 0 ? <QueueTableClient items={items} /> : <AdminEmptyState message="No content matches these filters." />}
    </div>
  );
}
