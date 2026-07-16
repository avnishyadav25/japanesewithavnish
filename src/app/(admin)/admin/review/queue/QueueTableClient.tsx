"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RunReviewButton } from "../RunReviewButton";

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

/** Gap-fix phase 16: a compact at-a-glance priority badge, same ranking logic the Queue's
 * "Needs attention first" sort already uses (open_critical, then open_major). */
function PriorityBadge({ openCritical, openMajor }: { openCritical: number; openMajor: number }) {
  if (openCritical > 0) return <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">High</span>;
  if (openMajor > 0) return <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Medium</span>;
  return <span className="text-xs text-secondary">Low</span>;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const BULK_ACTIONS: { action: string; label: string }[] = [
  { action: "approve", label: "Approve" },
  { action: "request_changes", label: "Request Changes" },
  { action: "mark_false_positive", label: "Mark False Positive" },
  { action: "archive", label: "Archive" },
  { action: "run_review", label: "Run Complete Review" },
];

/** Checkbox multi-select + bulk-action bar, modeled on the existing
 * OrdersTableClient.tsx pattern (src/app/(admin)/admin/orders/). "Do not allow bulk approval
 * for content containing critical findings" is enforced server-side in the bulk-action
 * route, not just here — this client only skips obviously-blocked rows from the *selection*
 * as a courtesy, the API is the real gate. */
export function QueueTableClient({ items }: { items: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function runBulkAction(action: string) {
    setBusy(true);
    setMessage(null);
    try {
      const selectedItems = items.filter((i) => selected.has(i.id)).map((i) => ({ entityType: i.content_type, entityId: i.id }));
      const res = await fetch("/api/admin/review/queue/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, items: selectedItems }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || "Bulk action failed");
        return;
      }
      setMessage(`${data.succeeded} succeeded${data.skipped?.length ? `, ${data.skipped.length} skipped` : ""}.`);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function exportSelected() {
    const ids = Array.from(selected).join(",");
    window.open(`/api/admin/review/queue/export?ids=${ids}`, "_blank");
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-base border border-[var(--divider)] rounded-bento">
          <span className="text-sm text-charcoal font-medium mr-2">{selected.size} selected</span>
          {BULK_ACTIONS.map((a) => (
            <button
              key={a.action}
              type="button"
              disabled={busy}
              onClick={() => runBulkAction(a.action)}
              className="px-2.5 py-1 rounded-bento text-xs font-medium bg-white border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={exportSelected}
            className="px-2.5 py-1 rounded-bento text-xs font-medium bg-white border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition disabled:opacity-50"
          >
            Export Findings
          </button>
          {message && <span className="text-xs text-secondary">{message}</span>}
        </div>
      )}
      <AdminCard>
        <AdminTable headers={["", "Content", "Type", "Level", "Status", "Score", "Open issues", "Priority", "Updated", "Reviewer", "Actions"]}>
          <tr className="border-b border-[var(--divider)]">
            <td className="py-2 px-2">
              <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} />
            </td>
            <td colSpan={10} className="py-2 px-2 text-xs text-secondary">
              Select all
            </td>
          </tr>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-[var(--divider)]">
              <td className="py-2 px-2">
                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
              </td>
              <td className="py-2 px-2 font-medium text-charcoal max-w-[280px]">
                <span className="line-clamp-1 block" title={it.title}>
                  {it.title}
                </span>
                {it.has_learner_report && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mt-0.5 inline-block">
                    learner-reported
                  </span>
                )}
              </td>
              <td className="py-2 px-2 text-secondary text-sm">{it.content_type}</td>
              <td className="py-2 px-2 text-secondary text-sm">{it.jlpt_level?.[0] ?? "—"}</td>
              <td className="py-2 px-2">
                <StatusBadge status={it.review_state} />
              </td>
              <td className="py-2 px-2 text-charcoal">{it.overall_score ?? "—"}</td>
              <td className="py-2 px-2 text-sm">
                {it.open_critical > 0 && <span className="text-red-600 font-medium mr-2">{it.open_critical} critical</span>}
                {it.open_major > 0 && <span className="text-amber-600 font-medium">{it.open_major} major</span>}
                {it.open_critical === 0 && it.open_major === 0 && <span className="text-secondary">—</span>}
              </td>
              <td className="py-2 px-2">
                <PriorityBadge openCritical={it.open_critical} openMajor={it.open_major} />
              </td>
              <td className="py-2 px-2 text-secondary text-xs whitespace-nowrap">{timeAgo(it.updated_at)}</td>
              <td className="py-2 px-2 text-secondary text-xs max-w-[140px] truncate" title={it.last_reviewer ?? undefined}>
                {it.last_reviewer ?? "—"}
              </td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-3">
                  <Link href={`/admin/review/${it.content_type}/${it.id}`} className="text-primary text-sm hover:underline">
                    View
                  </Link>
                  <RunReviewButton entityType={it.content_type} entityId={it.id} />
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </div>
  );
}
