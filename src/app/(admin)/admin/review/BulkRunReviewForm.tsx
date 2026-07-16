"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";

export function BulkRunReviewForm() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<string>(REVIEW_ENTITY_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/review/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, reviewState: "not_reviewed" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResult(data?.error || "Failed to queue bulk review");
        return;
      }
      setResult(
        `Queued ${data.queuedCount} of ${data.candidateCount} never-reviewed ${entityType} item(s). ` +
          `They'll drain over the next few cron ticks (~10 min each, 3 at a time) — check back on the Review Queue.`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-secondary">Bulk-review all never-reviewed:</span>
      <select
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        className="border border-[var(--divider)] rounded-bento px-2 py-1.5 text-sm bg-white"
      >
        {REVIEW_ENTITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
        {loading ? "Queuing…" : "Queue Bulk Review"}
      </button>
      {result && <span className="text-sm text-secondary">{result}</span>}
    </form>
  );
}
