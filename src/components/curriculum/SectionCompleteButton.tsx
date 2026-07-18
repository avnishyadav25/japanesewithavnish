"use client";

import { useState } from "react";

/** Explicit, persisted per-section completion signal — the primary (not just decorative)
 * mechanism behind "X of Y sections completed" (see user_section_progress, migration 125).
 * Deliberately NOT scroll/IntersectionObserver-driven: an auto-complete-on-scroll signal would
 * make the count unreliable (background tabs, fast scrolling, keyboard navigation all defeat
 * it), so real progress tracking needs a real, explicit action instead. */
export function SectionCompleteButton({
  completed: initiallyCompleted,
  onComplete,
}: {
  completed: boolean;
  onComplete: () => Promise<void>;
}) {
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [loading, setLoading] = useState(false);

  if (completed) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold py-1">
        <span>✓</span>
        <span>Section complete</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onComplete();
          setCompleted(true);
        } finally {
          setLoading(false);
        }
      }}
      className="text-xs font-semibold text-primary border border-primary/30 rounded-bento px-3 py-1.5 hover:bg-primary/5 transition disabled:opacity-60"
    >
      {loading ? "Saving…" : "Mark section complete"}
    </button>
  );
}
