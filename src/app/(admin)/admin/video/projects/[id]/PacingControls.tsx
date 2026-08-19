"use client";

/**
 * Pacing, split by what it costs.
 *
 * The subtitle panel beside this one already promises "free of LLM and voiceover cost, since both
 * are cached", and pacing divides along the same line — so the panel has to say which side each
 * control is on, rather than hiding it behind one Apply button that is sometimes free and sometimes
 * rewrites narration you were happy with.
 *
 *   RE-CUT   repeat count, shadowing pause, scene padding. A repeated Japanese phrase is the same
 *            text, so it hashes to the same cached clip. Verified: every repeat count from 1 to 3
 *            resolves entirely from cache.
 *   REWRITE  seconds per item, examples per item. These set the word budget the model wrote to.
 *            There is no version of this that reuses the existing narration.
 */
import { useState } from "react";

interface Pacing {
  secondsPerItem: number;
  repeatJapanese: number;
  pauseAfterJapaneseSeconds: number;
  scenePaddingSeconds: number;
  examplesPerItem?: number;
}

export function PacingControls({
  projectId,
  initial,
  batchCount,
  stylePreset,
}: {
  projectId: string;
  initial: Pacing;
  /** How many projects share this one's batch, so "apply to all" can name a real number. */
  batchCount: number;
  stylePreset: "lesson" | "shorts";
}) {
  const [pacing, setPacing] = useState<Pacing>(initial);
  const [toBatch, setToBatch] = useState(false);
  const [busy, setBusy] = useState<null | "recut" | "rewrite" | "shorts">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recutChanged =
    pacing.repeatJapanese !== initial.repeatJapanese ||
    pacing.pauseAfterJapaneseSeconds !== initial.pauseAfterJapaneseSeconds ||
    pacing.scenePaddingSeconds !== initial.scenePaddingSeconds;
  const rewriteChanged =
    pacing.secondsPerItem !== initial.secondsPerItem ||
    (pacing.examplesPerItem ?? 1) !== (initial.examplesPerItem ?? 1);

  async function post(url: string, body: unknown, kind: "recut" | "rewrite" | "shorts", method = "PATCH") {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const data = text.trim() ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessage(data.message ?? "Done.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const batchToggle =
    batchCount > 1 ? (
      <label className="flex items-center gap-2 text-xs text-secondary mt-3">
        <input type="checkbox" checked={toBatch} onChange={(e) => setToBatch(e.target.checked)} />
        Apply to all {batchCount} projects in this batch
      </label>
    ) : null;

  return (
    <div className="border border-[var(--divider)] rounded-card p-4 space-y-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-charcoal text-sm uppercase tracking-wide">Pacing</h3>
        <span className="text-xs text-secondary">{stylePreset === "shorts" ? "Shorts" : "Lesson"}</span>
      </div>

      {/* ---- free ------------------------------------------------------- */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-charcoal">
          Re-cut <span className="font-normal text-secondary">— free, nothing is rewritten</span>
        </p>

        <div>
          <div className="flex justify-between text-sm">
            <span>Repeat the Japanese</span>
            <span className="tabular-nums text-secondary">{pacing.repeatJapanese}&times;</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={pacing.repeatJapanese}
            onChange={(e) => setPacing({ ...pacing, repeatJapanese: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-secondary">
            Hearing a word twice is the highest-value second in a language video. The clip is cached,
            so a third repeat costs render time and nothing else.
          </p>
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>Pause to repeat it back</span>
            <span className="tabular-nums text-secondary">{pacing.pauseAfterJapaneseSeconds.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={pacing.pauseAfterJapaneseSeconds}
            onChange={(e) => setPacing({ ...pacing, pauseAfterJapaneseSeconds: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>Breathing room per scene</span>
            <span className="tabular-nums text-secondary">{pacing.scenePaddingSeconds.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={pacing.scenePaddingSeconds}
            onChange={(e) => setPacing({ ...pacing, scenePaddingSeconds: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <button
          type="button"
          disabled={!recutChanged || busy !== null}
          onClick={() => void post(`/api/admin/video/projects/${projectId}/pacing`, { pacing, applyToBatch: toBatch }, "recut")}
          className="px-4 py-2 rounded-button bg-primary text-white text-sm font-semibold disabled:opacity-40"
        >
          {busy === "recut" ? "Re-cutting…" : "Re-cut and render"}
        </button>
        {batchToggle}
      </div>

      {/* ---- paid ------------------------------------------------------- */}
      <div className="space-y-3 border-t border-[var(--divider)] pt-4">
        <p className="text-xs font-semibold text-charcoal">
          Rewrite <span className="font-normal text-secondary">— regenerates the script, so the wording changes</span>
        </p>

        <div>
          <div className="flex justify-between text-sm">
            <span>Seconds per item</span>
            <span className="tabular-nums text-secondary">{pacing.secondsPerItem}s</span>
          </div>
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={pacing.secondsPerItem}
            onChange={(e) => setPacing({ ...pacing, secondsPerItem: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-secondary">
            This is the budget the model writes to, not a cap applied afterwards.
          </p>
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <span>Examples per item</span>
            <span className="tabular-nums text-secondary">{pacing.examplesPerItem ?? 1}</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={pacing.examplesPerItem ?? 1}
            onChange={(e) => setPacing({ ...pacing, examplesPerItem: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-secondary">
            A ceiling, not a target — the content has to have them. Grammar averages 4.4 examples per
            point, but only 12% of vocabulary and 16% of kanji have more than one, so raising this
            changes a grammar video a lot and most vocabulary videos not at all.
          </p>
        </div>

        <button
          type="button"
          disabled={!rewriteChanged || busy !== null}
          onClick={() =>
            void post(`/api/admin/video/projects/${projectId}/generate`, { pacing, regenerate: true }, "rewrite", "POST")
          }
          className="px-4 py-2 rounded-button border border-primary text-primary text-sm font-semibold disabled:opacity-40"
        >
          {busy === "rewrite" ? "Rewriting…" : "Rewrite the script"}
        </button>
      </div>

      {/* ---- preset ------------------------------------------------------ */}
      {stylePreset === "lesson" && (
        <div className="border-t border-[var(--divider)] pt-4">
          <p className="text-xs text-secondary mb-2">
            This project is lesson-paced: one card per item, and a silent mascot beat at the front.
            Switching splits each item into short beats, speaks the hook over the first second and
            turns on word-by-word captions. It regenerates the script, because the beat split happens
            at generation — a re-cut cannot produce it.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void post(
                `/api/admin/video/projects/${projectId}/generate`,
                { pacing, regenerate: true, stylePreset: "shorts" },
                "shorts",
                "POST"
              )
            }
            className="px-4 py-2 rounded-button border border-[var(--divider)] text-charcoal text-sm font-semibold disabled:opacity-40"
          >
            {busy === "shorts" ? "Converting…" : "Switch to Shorts pacing"}
          </button>
        </div>
      )}

      {message && <p className="text-xs text-green-700">{message}</p>}
      {error && <p className="text-xs text-primary">{error}</p>}
    </div>
  );
}
