"use client";

import { useState } from "react";
import Link from "next/link";

export function LearnMarkAsLearned({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addToReview, setAddToReview] = useState(true);

  async function handleMark() {
    if (loading || saved) return;
    setLoading(true);
    try {
      const res = await fetch("/api/learn/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, status: "learned", addToReview }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 mb-6 border-y border-[var(--divider)]">
      <button
        type="button"
        onClick={handleMark}
        disabled={loading || saved}
        className="px-4 py-2 rounded-bento bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
      >
        {saved ? "Marked as learned" : loading ? "Saving…" : "Mark as learned"}
      </button>
      {!saved && (
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={addToReview}
            onChange={(e) => setAddToReview(e.target.checked)}
            className="rounded border-[var(--divider)]"
          />
          Add to review queue
        </label>
      )}
      <Link href="/learn/dashboard" className="text-sm text-primary hover:underline">
        My progress →
      </Link>
    </div>
  );
}
