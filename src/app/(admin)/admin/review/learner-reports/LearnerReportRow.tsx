"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LearnerReportRow({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(status: string, triageAndReview = false) {
    setBusy(true);
    try {
      await fetch(`/api/admin/review/learner-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, triageAndReview }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => updateStatus("triaged", true)} className="text-primary text-xs hover:underline disabled:opacity-50">
        Triage + Run Review
      </button>
      <button disabled={busy} onClick={() => updateStatus("resolved")} className="text-emerald-700 text-xs hover:underline disabled:opacity-50">
        Resolve
      </button>
      <button disabled={busy} onClick={() => updateStatus("dismissed")} className="text-secondary text-xs hover:underline disabled:opacity-50">
        Dismiss
      </button>
    </div>
  );
}
