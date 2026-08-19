"use client";

/**
 * What changed in each version of the script.
 *
 * The version picker was a `<select>` showing "v3 · regenerated" and nothing else, so a project with
 * four versions offered four indistinguishable rows. `source` cannot answer the question — a
 * re-cut, a rewrite and a preset switch are all "human_edited" or "regenerated".
 *
 * Two sources, because neither alone is enough:
 *   - `changeSummary` is written when the version is created, so it is exact ("Repeat 2× → 3×").
 *     Null on anything made before that column existed.
 *   - `diffStoryboards` computes an answer from the documents, so history that predates the
 *     feature is still explainable. Verified against this project's real v1→v4: it reports the
 *     re-cut as "3 → 4 Japanese clips" and the rewrites as word-count changes.
 */
import { useState } from "react";
import { diffStoryboards, describeDiff } from "@/lib/video/storyboardDiff";
import type { Storyboard } from "@/lib/video/types";
import { StatusBadge } from "@/components/admin/StatusBadge";

export interface VersionRow {
  id: string;
  version: number;
  source: string;
  approvalStatus: string;
  createdAt: string;
  createdBy: string | null;
  estimatedCostUsd: number | null;
  changeSummary: string | null;
  parentStoryboardId: string | null;
  doc: Storyboard;
}

export function VersionHistory({
  versions,
  selectedId,
  onSelect,
}: {
  /** Ordered oldest first. */
  versions: VersionRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-[var(--divider)]">
      {[...versions].reverse().map((v, i, reversed) => {
        // The recorded parent when there is one; otherwise the version before it, which is what
        // the parent would have been for anything created before lineage was stored.
        const parent =
          versions.find((x) => x.id === v.parentStoryboardId) ?? reversed[i + 1] ?? null;
        const diff = parent ? diffStoryboards(parent.doc, v.doc) : null;
        const open = openId === v.id;
        const isSelected = v.id === selectedId;

        return (
          <div key={v.id} className={`py-2.5 ${isSelected ? "bg-red-light/40 -mx-3 px-3" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className="text-left flex-1 min-w-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-charcoal">v{v.version}</span>
                  <StatusBadge status={v.approvalStatus} />
                  <span className="text-xs text-secondary">{v.source.replace(/_/g, " ")}</span>
                  {v.estimatedCostUsd ? (
                    <span className="text-xs text-secondary tabular-nums">${v.estimatedCostUsd.toFixed(4)}</span>
                  ) : null}
                </div>
                <div className="text-xs text-charcoal/80 mt-0.5">
                  {/* Recorded beats computed: the summary knows WHY, the diff only knows WHAT. */}
                  {v.changeSummary ?? (diff ? describeDiff(diff) : "First version")}
                </div>
                <div className="text-[11px] text-secondary mt-0.5">
                  {new Date(v.createdAt).toLocaleString()}
                  {v.createdBy ? ` · ${v.createdBy}` : ""}
                </div>
              </button>

              {diff && !diff.identical && (
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : v.id)}
                  className="text-xs text-primary hover:underline whitespace-nowrap shrink-0"
                >
                  {open ? "Hide changes" : "See changes"}
                </button>
              )}
            </div>

            {open && diff && (
              <div className="mt-2 rounded-card border border-[var(--divider)] p-3 space-y-3">
                {diff.headline.length > 0 && (
                  <ul className="text-xs text-charcoal space-y-0.5">
                    {diff.headline.map((h) => (
                      <li key={h}>· {h}</li>
                    ))}
                  </ul>
                )}
                {diff.scenes.map((s) => (
                  <div key={s.sceneId} className="text-xs">
                    <div className="font-semibold text-charcoal">
                      {s.sceneId} <span className="font-normal text-secondary">{s.sceneType.replace(/_/g, " ")} · {s.kind}</span>
                    </div>
                    {s.notes?.length ? <div className="text-secondary">{s.notes.join(" · ")}</div> : null}
                    {s.segments?.map((seg) => (
                      <div key={seg.segmentId} className="mt-1 space-y-0.5">
                        {seg.before !== null && (
                          <div className="text-secondary line-through decoration-primary/40">{seg.before}</div>
                        )}
                        {seg.after !== null && <div className="text-charcoal">{seg.after}</div>}
                      </div>
                    ))}
                  </div>
                ))}
                {diff.scenes.length === 0 && diff.headline.length === 0 && (
                  <p className="text-xs text-secondary">Nothing changed in the script itself.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
