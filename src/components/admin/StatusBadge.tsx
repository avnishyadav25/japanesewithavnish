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
  | "archived"
  // video_projects.status
  | "generating_script"
  | "script_ready"
  | "script_pending_review"
  | "queued_render"
  | "rendering"
  | "render_ready"
  | "video_pending_review"
  | "publishing"
  // video_render_jobs.status
  | "claimed"
  | "running"
  | "completed"
  | "cancelled"
  // video_renders.approval_status / video_storyboards.approval_status
  | "not_required"
  | "pending_review"
  | "superseded";

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
  generating_script: "bg-blue-50 text-blue-700 border-blue-200",
  script_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  script_pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  queued_render: "bg-blue-50 text-blue-700 border-blue-200",
  rendering: "bg-blue-50 text-blue-700 border-blue-200",
  render_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  video_pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  publishing: "bg-blue-50 text-blue-700 border-blue-200",
  claimed: "bg-blue-50 text-blue-700 border-blue-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  not_required: "bg-slate-100 text-slate-600 border-slate-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  superseded: "bg-slate-100 text-slate-600 border-slate-200",
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
