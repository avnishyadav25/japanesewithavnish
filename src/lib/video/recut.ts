/**
 * Changes you can make to a finished storyboard WITHOUT paying for anything.
 *
 * The subtitle panel already established this promise — *"free of LLM and voiceover cost, since
 * both are cached"* — and pacing splits along the same line. Some pacing fields are pure timing;
 * some are the word budget the model wrote to and cannot be changed without a rewrite. This module
 * is only the first kind, and the API route is what keeps the two apart.
 *
 * WHY REPEATING THE JAPANESE IS FREE. The TTS cache is keyed on
 * sha256(ssml + voice + rate + pitch). A repeated phrase is the SAME text and the same `spokenAs`,
 * so `buildSsml` produces an identical string, so the hash matches and the worker gets a cache hit.
 * Adding a third repeat therefore costs one more scene-second of render and nothing else. Removing
 * one costs nothing either. This is only true while the clone keeps `text` and `spokenAs` byte-
 * identical — change either and the promise silently becomes a bill.
 */
import type { NarrationSegment, PacingConfig, Scene, Storyboard } from "./types";

/** Segments produced by `pushJapanese`: same base id, suffixed -1, -2, -3, all identical text. */
function repeatGroupKey(segment: NarrationSegment): string | null {
  if (segment.lang !== "ja") return null;
  const m = /^(.*)-(\d+)$/.exec(segment.id);
  return m ? m[1] : null;
}

/**
 * Rewrites each Japanese repeat run to `count` copies.
 *
 * Lead-ins and the trailing shadowing pause are reproduced exactly as `pushJapanese` sets them —
 * the first copy keeps the run's original lead-in, later copies get the short one, and only the
 * last carries `pauseAfterSeconds`. Getting that wrong would not error; it would just put the
 * learner's gap in the middle of the run.
 */
export function setJapaneseRepeats(scene: Scene, count: number, pacing: PacingConfig): Scene {
  const out: NarrationSegment[] = [];
  let i = 0;
  let changed = false;

  while (i < scene.narration.length) {
    const key = repeatGroupKey(scene.narration[i]);
    if (!key) {
      out.push(scene.narration[i]);
      i += 1;
      continue;
    }
    // Collect the whole run: same base id, same spoken content.
    const run: NarrationSegment[] = [];
    while (
      i < scene.narration.length &&
      repeatGroupKey(scene.narration[i]) === key &&
      // Compared against the RUN's first segment, not narration[0] — a repeat run is defined by
      // identical text, and anchoring on the scene's first segment would match the wrong thing
      // entirely on any scene whose Japanese is not first.
      (run.length === 0 || scene.narration[i].text === run[0].text)
    ) {
      run.push(scene.narration[i]);
      i += 1;
    }
    const first = run[0];
    /**
     * ADDED COPIES REUSE A LEAD-IN THE RUN ALREADY HAS. This is the whole reason the change is
     * free, and the first version got it wrong.
     *
     * `buildSsml` renders `leadInSeconds` as a `<break time="Nms"/>` INSIDE the SSML, and the cache
     * key is a hash of that SSML. So a clone with a lead-in no existing segment used is a different
     * string, a different hash, and a synthesis charge — measured: three clones produced two
     * distinct hashes, and the "free" label on the panel would have been a lie.
     *
     * Copying the last existing segment's lead-in guarantees every added copy hashes to something
     * already in the cache. The cost is that a second repeat may carry a 250ms lead rather than
     * 100ms — a difference nobody can hear, in exchange for a promise that holds.
     */
    const addedLeadIn = run[run.length - 1]?.leadInSeconds ?? first.leadInSeconds;
    for (let n = 0; n < count; n += 1) {
      const isLast = n === count - 1;
      out.push({
        ...first,
        id: `${key}-${n + 1}`,
        // Cloned verbatim: text and spokenAs are what the cache key is built from.
        text: first.text,
        spokenAs: first.spokenAs,
        leadInSeconds: n === 0 ? first.leadInSeconds : addedLeadIn,
        pauseAfterSeconds: isLast ? pacing.pauseAfterJapaneseSeconds : undefined,
        // Dropped so the worker re-resolves from cache; keeping a stale clip on a cloned segment
        // would give every repeat the first one's duration.
        audio: undefined,
      });
    }
    if (run.length !== count) changed = true;
  }

  return changed ? { ...scene, narration: out } : scene;
}

/**
 * Applies the free pacing fields across a storyboard.
 *
 * `audio` is cleared on every segment the transform touched, so the worker's TTS stage re-resolves
 * them — from cache, at no cost — and the timeline stage recomputes durations. Segments it did not
 * touch keep their clips and are not re-fetched at all.
 */
export function recutStoryboard(storyboard: Storyboard, pacing: PacingConfig): Storyboard {
  const scenes = storyboard.scenes.map((scene) => {
    const withRepeats = setJapaneseRepeats(scene, Math.max(1, Math.min(3, Math.round(pacing.repeatJapanese))), pacing);
    return {
      ...withRepeats,
      narration: withRepeats.narration.map((segment) =>
        segment.lang === "ja" && segment.pauseAfterSeconds !== undefined
          ? { ...segment, pauseAfterSeconds: pacing.pauseAfterJapaneseSeconds }
          : segment
      ),
    };
  });

  return {
    ...storyboard,
    scenes,
    // Dropped so the worker rebuilds it. A stale timeline would keep the old frame spans and the
    // video would be cut to durations that no longer exist.
    resolved: undefined,
  };
}

/** Fields that can be applied by a re-cut. Anything else needs the script regenerating. */
export const FREE_PACING_FIELDS = ["repeatJapanese", "pauseAfterJapaneseSeconds", "scenePaddingSeconds"] as const;
export const REWRITE_PACING_FIELDS = ["secondsPerItem", "examplesPerItem"] as const;

export function needsRewrite(before: PacingConfig, after: Partial<PacingConfig>): boolean {
  return REWRITE_PACING_FIELDS.some(
    (f) => after[f] !== undefined && Number(after[f]) !== Number(before[f])
  );
}
