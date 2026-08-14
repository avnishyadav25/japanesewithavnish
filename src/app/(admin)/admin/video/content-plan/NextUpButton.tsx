"use client";

import { useState } from "react";

interface Suggestion {
  title: string;
  reason: string;
  contentType?: string;
  jlptLevel?: string;
  platforms?: string[];
}

/**
 * The "what should I make next" popup.
 *
 * A client island rather than an `AdminPageHeader` action, because the page is a server
 * component and `ActionItem.onClick` is a function — a server component cannot pass one across
 * the boundary.
 *
 * Each suggestion links straight into the wizard with the scope pre-filled, so reading the
 * answer and acting on it are one step.
 */
export function NextUpButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setOpen(true);
    if (suggestions || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social/content-plan/hint", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSuggestions(json.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={ask} className="btn-primary text-sm">
        What should I make next?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:p-10 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="card-content max-w-[640px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-charcoal">What to make next</h3>
                <p className="text-xs text-secondary mt-1">
                  Read off the coverage counts on this page — every suggestion cites the number behind it.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-secondary hover:text-charcoal text-xl leading-none">
                ×
              </button>
            </div>

            {loading && <p className="text-sm text-secondary">Reading the numbers…</p>}
            {error && <p className="text-sm text-primary">{error}</p>}

            {suggestions && suggestions.length === 0 && (
              <p className="text-sm text-secondary">No meaningful gap to report right now.</p>
            )}

            {suggestions && suggestions.length > 0 && (
              <ol className="space-y-4">
                {suggestions.map((s, i) => {
                  const query = new URLSearchParams();
                  if (s.contentType) query.set("contentType", s.contentType);
                  if (s.jlptLevel) query.set("jlptLevel", s.jlptLevel);
                  return (
                    <li key={i} className="border-t border-[var(--divider)] pt-3 first:border-t-0 first:pt-0">
                      <p className="font-medium text-charcoal">{s.title}</p>
                      <p className="text-sm text-secondary mt-1">{s.reason}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <a
                          href={`/admin/video/new${query.toString() ? `?${query}` : ""}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Start this video →
                        </a>
                        {s.platforms && s.platforms.length > 0 && (
                          <span className="text-xs text-secondary">{s.platforms.join(" · ")}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
