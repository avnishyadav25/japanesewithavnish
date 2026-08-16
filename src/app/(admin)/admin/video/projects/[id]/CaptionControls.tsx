"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { DEFAULT_CAPTIONS, resolveCaptions, type CaptionSettings } from "@/lib/video/types";

/**
 * Subtitle appearance for one project.
 *
 * Its own file rather than another section inside ProjectWorkspace, which is already past 1100
 * lines carrying the storyboard editor, the job list and the render list — the same reasoning
 * that kept the social panel out of it.
 *
 * Changes apply to the live preview immediately via `onChange`, and are only written to the
 * project on Save. Nothing here touches the storyboard: caption style is read at render time, so
 * the effect on a finished video comes from a re-cut, which costs render minutes and no LLM or
 * TTS spend.
 */
export function CaptionControls({
  projectId,
  value,
  onChange,
  hasRenders,
  onRecut,
  recutting,
}: {
  projectId: string;
  value: Partial<CaptionSettings> | null;
  onChange: (next: Required<CaptionSettings>) => void;
  hasRenders: boolean;
  /** Re-renders the existing formats so finished videos pick the new style up. */
  onRecut?: () => void;
  recutting?: boolean;
}) {
  const current = resolveCaptions(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dirtySinceSave, setDirtySinceSave] = useState(false);

  function set<K extends keyof CaptionSettings>(key: K, v: Required<CaptionSettings>[K]) {
    onChange({ ...current, [key]: v });
    setSaved(null);
    setDirtySinceSave(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/admin/video/projects/${projectId}/captions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captions: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      onChange(data.captions);
      setSaved(data.message ?? "Saved.");
      setDirtySinceSave(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs uppercase tracking-wider text-secondary font-semibold">Subtitles</span>
        <span className="text-xs text-secondary">
          {current.enabled ? `${Math.round(current.scale * 100)}% · ${current.position}` : "off"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={current.enabled} onChange={(e) => set("enabled", e.target.checked)} />
            Burn subtitles into the video
          </label>

          {current.enabled && (
            <>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-charcoal">Size</span>
                  <span className="text-secondary tabular-nums">{Math.round(current.scale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.05}
                  value={current.scale}
                  onChange={(e) => set("scale", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-secondary mt-1">
                  100% is the old default, which covered the content on vertical videos. 80% is the new one.
                </p>
              </div>

              <div>
                <span className="block text-sm font-semibold text-charcoal mb-1.5">Position</span>
                <div className="flex gap-2">
                  {(["bottom", "lower-third", "top"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("position", p)}
                      className={`px-3 py-1.5 rounded-button text-sm border transition ${
                        current.position === p
                          ? "border-primary bg-red-light text-primary font-semibold"
                          : "border-[var(--divider)] text-secondary hover:border-primary/40"
                      }`}
                    >
                      {p === "lower-third" ? "Lower third" : p === "top" ? "Top" : "Bottom"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-charcoal">Background</span>
                  <span className="text-secondary tabular-nums">{Math.round(current.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={current.opacity}
                  onChange={(e) => set("opacity", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-secondary mt-1">
                  At 0 the text keeps its drop shadow and the plate disappears.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-charcoal">Max width</span>
                  <span className="text-secondary tabular-nums">{current.maxWidthPct}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={2}
                  value={current.maxWidthPct}
                  onChange={(e) => set("maxWidthPct", Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange({ ...DEFAULT_CAPTIONS });
                setSaved(null);
              }}
              className="text-sm text-secondary hover:text-charcoal"
            >
              Reset
            </button>
          </div>

          {saved && <p className="text-xs text-emerald-700">{saved}</p>}
          {error && <p className="text-xs text-primary">{error}</p>}

          {/* The re-cut lives here rather than only on the render card, because this is where you
              just changed the thing that makes a re-cut worth paying for. Disabled until saved:
              the worker reads the project row, so re-cutting an unsaved slider renders the old
              style and looks like the setting does nothing. */}
          {hasRenders && onRecut && (
            <div className="pt-2 border-t border-[var(--divider)] space-y-2">
              <p className="text-xs text-secondary">
                The preview above already shows this. Finished videos keep their old subtitles until
                re-rendered — free of LLM and voiceover cost, since both are cached.
              </p>
              <button
                type="button"
                onClick={onRecut}
                disabled={recutting || dirtySinceSave}
                title={dirtySinceSave ? "Save first — the renderer reads the saved setting" : undefined}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {recutting ? "Queueing…" : "Re-render with these subtitles"}
              </button>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}
