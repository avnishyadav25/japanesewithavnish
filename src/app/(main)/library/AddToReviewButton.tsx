"use client";

import { useState } from "react";

export function AddToReviewButton({ itemId, itemType = "lesson" }: { itemId: string; itemType?: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function addToReview() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", itemType, itemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add to review queue.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to review queue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={addToReview}
        disabled={loading || done}
        className="px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold hover:bg-primary/10 disabled:opacity-60"
      >
        {done ? "Added" : loading ? "Adding..." : "Add to review queue"}
      </button>
      {error && <span className="text-[10px] text-primary max-w-[180px] text-right">{error}</span>}
    </div>
  );
}
