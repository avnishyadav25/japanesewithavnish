"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunReviewButton({ entityType, entityId }: { entityType: string; entityId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedScore, setSkippedScore] = useState<number | null | undefined>(undefined);

  async function handleClick(force = false) {
    setLoading(true);
    setError(null);
    setSkippedScore(undefined);
    try {
      const res = await fetch("/api/admin/review/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, force }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Review failed to start");
        return;
      }
      if (data?.skipped) {
        // Gap-fix phase 11: content hasn't changed since the last completed run — re-running
        // the full agent suite would just reproduce identical findings at real LLM cost.
        setSkippedScore(data.run?.overallScore ?? null);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button type="button" onClick={() => handleClick(false)} disabled={loading} className="text-primary text-sm hover:underline disabled:opacity-50">
        {loading ? "Reviewing…" : "Run Review"}
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
      {skippedScore !== undefined && (
        <span className="text-xs text-secondary">
          No changes since last review{skippedScore !== null ? ` (score: ${skippedScore})` : ""} —{" "}
          <button type="button" onClick={() => handleClick(true)} disabled={loading} className="text-primary hover:underline disabled:opacity-50">
            force re-review anyway
          </button>
        </span>
      )}
    </div>
  );
}
