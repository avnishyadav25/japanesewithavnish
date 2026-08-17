"use client";

import { formatDuration } from "@/lib/video/pacing";

export interface ScopeEstimate {
  title: string;
  jlptLevel: string | null;
  contentKind: string | null;
  itemCount: number;
  plannedVideos: number;
  plannedRenders: number;
  achievedSecondsPerItem: number;
  sceneCount: number;
  estimate: {
    perVideoSeconds: number;
    perVideoReadable: string;
    totalSeconds: number;
    ttsCostUsd: number;
    renderMinutes: number;
    breakdown?: { japaneseSeconds: number; narrationSeconds: number; pauseSeconds: number };
  };
  warnings: string[];
  items: { postId: string | null; title: string; kind: string; url?: string | null; jlptLevel: string | null; exampleCount: number }[];
}

/**
 * The running total, visible from step one.
 *
 * This panel is the reason the wizard exists. Before it, "10 N4 grammar patterns" gave no hint
 * that it meant six minutes of video across 36 scenes, and "a separate video per item" over an
 * unfiltered type quietly meant hundreds of renders. Every number here comes from the same
 * measured speech rates the generator budgets against, so it is a forecast rather than a guess.
 */
export function EstimatePanel({
  estimate,
  loading,
  error,
}: {
  estimate: ScopeEstimate | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <aside className="lg:sticky lg:top-6">
      <div className="card-content">
        <div className="text-xs uppercase tracking-wider text-secondary font-semibold mb-4">This run</div>

        {error ? (
          <p className="text-sm text-primary">{error}</p>
        ) : !estimate ? (
          <p className="text-sm text-secondary">
            {loading ? "Working it out…" : "Choose what the video covers and this fills in."}
          </p>
        ) : (
          <>
            <dl className="space-y-3 text-sm">
              <Row label="Items" value={String(estimate.itemCount)} />
              <Row label="Length each" value={estimate.estimate.perVideoReadable} strong />
              <Row
                label="Videos"
                value={`${estimate.plannedVideos} · ${estimate.plannedRenders} render${estimate.plannedRenders === 1 ? "" : "s"}`}
              />
              <Row
                label="Voiceover"
                value={estimate.estimate.ttsCostUsd < 0.01 ? "under a cent" : `~$${estimate.estimate.ttsCostUsd.toFixed(2)}`}
              />
              <Row label="Render time" value={`~${estimate.estimate.renderMinutes} min`} />
              {estimate.plannedRenders > 1 && (
                <Row label="Total footage" value={formatDuration(estimate.estimate.totalSeconds)} />
              )}
            </dl>

            {estimate.plannedRenders > 20 && (
              <p className="mt-4 text-xs text-primary border-t border-[var(--divider)] pt-3">
                {estimate.plannedRenders} renders is a lot of machine time. Consider narrowing the scope, or
                running it overnight on your Mac rather than in CI.
              </p>
            )}

            {estimate.warnings.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-[var(--divider)] pt-3">
                {estimate.warnings.map((warning, i) => (
                  <li key={i} className="text-xs text-amber-700 leading-relaxed">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className={strong ? "font-heading text-lg font-bold text-charcoal" : "text-charcoal"}>{value}</dd>
    </div>
  );
}
