/**
 * Word-level caption timing.
 *
 * A caption cue is one whole narration segment — up to 22 words for the intro hook — and until now
 * it appeared as a single static block for as long as it took to say. That is fine in a lesson and
 * wrong in a Short: on muted playback, which is how most Reels start, a block of text that does not
 * move gives a viewer nothing to follow and no reason to stay.
 *
 * Timings come from one of two places, in this order:
 *
 *   1. MEASURED. Google returns a timepoint per SSML `<mark>`, and the TTS layer wraps each word in
 *      one. These are exact — they account for the pauses and emphasis the voice actually produced.
 *   2. ESTIMATED, by this module, when measured ones are unavailable: clips cached before timings
 *      existed, Chirp3-HD voices (which reject SSML outright), Japanese (no whitespace to split
 *      on), and any cue long enough to have been chunked.
 *
 * The estimator is proportional to CHARACTER COUNT rather than word count, which matters more than
 * it sounds: "a" and "conversation" take very different times to say, so splitting a cue evenly by
 * word count drifts badly within a single sentence. Character-proportional splitting is not exact —
 * it cannot know where the voice paused — but it degrades smoothly and never runs ahead of the
 * audio, which is the failure that would be noticed.
 *
 * Isomorphic: Remotion components import this in the browser, so it must stay free of Node.
 */
import type { NarrationLang, WordTiming } from "./types";

/**
 * Relative time cost of a character, per language.
 *
 * Only the RATIOS matter here, not the absolute values, because the result is normalised across
 * the cue's real measured duration. Taken from the same measurements as SPEECH_RATES in pacing.ts.
 */
const RELATIVE_CHAR_COST: Record<NarrationLang, number> = {
  en: 1,
  hi: 1.14,
  hinglish: 1.06,
  // A Japanese character carries far more time than a Latin one — 4.91 c/s against 16.3 — but
  // Japanese cues are not word-split anyway, so this exists only for completeness.
  ja: 3.32,
};

/** Splits a cue's text into words with estimated start times. */
export function estimateWordTimings(text: string, durationSeconds: number, lang: NarrationLang): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || durationSeconds <= 0) return [];
  if (words.length === 1) return [{ text: words[0], start: 0 }];

  const cost = RELATIVE_CHAR_COST[lang] ?? 1;
  // A word carries its own characters plus the space after it — a nine-word sentence spends real
  // time on its gaps, and ignoring them compounds the drift toward the end of the cue.
  const weights = words.map((w) => (w.length + 1) * cost);
  const total = weights.reduce((a, b) => a + b, 0);

  const out: WordTiming[] = [];
  let elapsed = 0;
  for (let i = 0; i < words.length; i += 1) {
    out.push({ text: words[i], start: (elapsed / total) * durationSeconds });
    elapsed += weights[i];
  }
  return out;
}

/**
 * The index of the word being spoken at `t` seconds into a cue, or -1 before the first one.
 *
 * Timings are start-only — a word runs until the next one begins, and the last runs to the end of
 * the cue. Storing explicit ends would be redundant and would let the two disagree.
 */
export function activeWordIndex(words: readonly WordTiming[], t: number): number {
  if (words.length === 0) return -1;
  let index = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (t >= words[i].start) index = i;
    else break;
  }
  return index;
}

/**
 * Measured timings when present, estimated otherwise.
 *
 * Measured timings are validated rather than trusted: a clip whose marks all report 0, or which
 * reports fewer than half the words in the text, is treated as unusable. That has been seen when a
 * voice silently ignores marks, and half a highlighted caption is worse than an evenly estimated
 * one because it stalls partway and looks broken rather than approximate.
 */
export function wordTimingsFor(params: {
  text: string;
  durationSeconds: number;
  lang: NarrationLang;
  measured?: WordTiming[] | null;
}): WordTiming[] {
  const { text, durationSeconds, lang, measured } = params;
  const expected = text.trim().split(/\s+/).filter(Boolean).length;
  if (measured && measured.length > 0 && measured.length >= expected / 2) {
    const spread = measured[measured.length - 1].start - measured[0].start;
    if (spread > 0) return measured;
  }
  return estimateWordTimings(text, durationSeconds, lang);
}
