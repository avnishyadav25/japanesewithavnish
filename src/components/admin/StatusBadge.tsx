type StatusVariant =
  | "paid"
  | "pending"
  | "failed"
  | "created"
  | "draft"
  | "published"
  // content_review_findings.severity
  | "critical"
  | "major"
  | "minor"
  | "suggestion"
  | "info"
  // posts.review_state
  | "not_reviewed"
  | "queued"
  | "validating"
  | "validation_failed"
  | "ai_reviewing"
  | "needs_human_review"
  | "changes_requested"
  | "approved"
  | "publish_ready"
  | "rejected"
  | "archived";

const variantStyles: Record<StatusVariant, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  created: "bg-slate-100 text-slate-600 border-slate-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  major: "bg-amber-50 text-amber-700 border-amber-200",
  minor: "bg-blue-50 text-blue-700 border-blue-200",
  suggestion: "bg-slate-100 text-slate-600 border-slate-200",
  info: "bg-slate-100 text-slate-600 border-slate-200",
  not_reviewed: "bg-slate-100 text-slate-600 border-slate-200",
  queued: "bg-blue-50 text-blue-700 border-blue-200",
  validating: "bg-blue-50 text-blue-700 border-blue-200",
  validation_failed: "bg-red-50 text-red-700 border-red-200",
  ai_reviewing: "bg-blue-50 text-blue-700 border-blue-200",
  needs_human_review: "bg-amber-50 text-amber-700 border-amber-200",
  changes_requested: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  publish_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const v = variant ?? (status.toLowerCase() as StatusVariant);
  const style = variantStyles[v] ?? variantStyles.created;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
}
