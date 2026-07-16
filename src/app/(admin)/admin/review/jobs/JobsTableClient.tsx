"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Job = {
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

function CancelButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review/jobs/${jobId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Could not cancel");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={cancel} className="text-red-600 text-xs hover:underline disabled:opacity-50">
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}

export function JobsTableClient({ jobs, showCancel }: { jobs: Job[]; showCancel: boolean }) {
  return (
    <AdminTable headers={["Content", "Type", "Trigger", "Status", "Requested by", "Created", ...(showCancel ? ["Actions"] : [])]}>
      {jobs.map((j) => (
        <tr key={j.id} className="border-b border-[var(--divider)]">
          <td className="py-2 px-2 font-medium text-charcoal max-w-[240px]">
            <Link href={`/admin/review/${j.entity_type}/${j.entity_id}`} className="line-clamp-1 block hover:underline" title={j.title ?? j.entity_id}>
              {j.title ?? j.entity_id}
            </Link>
          </td>
          <td className="py-2 px-2 text-secondary text-sm">{j.entity_type}</td>
          <td className="py-2 px-2 text-secondary text-xs">{j.trigger_type}</td>
          <td className="py-2 px-2">
            <StatusBadge status={j.status} />
            {j.status === "failed" && j.error_message && <p className="text-[10px] text-red-600 mt-0.5 max-w-[180px] truncate" title={j.error_message}>{j.error_message}</p>}
          </td>
          <td className="py-2 px-2 text-secondary text-xs">{j.requested_by ?? "system"}</td>
          <td className="py-2 px-2 text-secondary text-xs whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</td>
          {showCancel && (
            <td className="py-2 px-2">{j.status === "queued" && <CancelButton jobId={j.id} />}</td>
          )}
        </tr>
      ))}
    </AdminTable>
  );
}
