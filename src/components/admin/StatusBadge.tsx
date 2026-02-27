type StatusVariant = "paid" | "pending" | "failed" | "created" | "draft" | "published";

const variantStyles: Record<StatusVariant, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  created: "bg-slate-100 text-slate-600 border-slate-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
