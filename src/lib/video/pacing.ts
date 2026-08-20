/**
 * Video Studio — the pacing engine.
 *
 * This exists because `targetDurationSeconds` never did anything. It was advisory prose in the
 * LLM prompt ("Target total length: about 60 seconds") while the per-slot word limits were
 * hardcoded constants in the skeleton builder. Nothing connected the two, so both real projects
 * asked for 60 seconds: one produced 121s, the other would have produced 6-7 minutes.
 *
 * The fix is to make duration arithmetic. Everything here derives from speech rates MEASURED
 * from our own synthesised clips rather than guessed — see SPEECH_RATES below. The same
 * constants produce the word budget handed to the model and the estimate shown in the UI, so a
 * miss is a calibration problem with one place to fix rather than two numbers that were never
 * related.
 *
 * No `next/*` imports — the worker uses this too.
 */
import type { ContentSnapshot, NarrationLang, PacingConfig, Scene, VideoStylePreset } from "./types";

/**
 * Characters per second of finished audio, per language.
 *
 * MEASURED, and reproducible: `npm run video:measure-rates` synthesises 15 varied narration
 * sentences per language through the same synthesize() the renderer uses and prints these numbers.
 *
 *   en-US-Neural2-F @1.0x : 15 clips, 1120 chars, 68.7s -> 16.30 c/s
 *   hi-IN-Neural2-A @1.0x : 15 clips, 1001 chars, 70.1s -> 14.29 c/s
 *   en-IN-Neural2-A @1.0x : 15 clips, 1144 chars, 74.1s -> 15.45 c/s   (hinglish)
 *   ja-JP-Neural2-B @0.9x : 15 clips,  306 chars, 62.3s ->  4.91 c/s
 *
 * WHY THESE REPLACED en 14.38 / hi 11.50 / ja 3.82. The originals were pooled over 49 real cached
 * clips, and those clips were mostly very short — the ja set was 30 clips totalling 169 chars, i.e.
 * single words. A clip carries ~0.36s of fixed onset and decay regardless of length, so a one-word
 * clip measures mostly overhead: "cat" alone reads at 4.43 c/s where a full sentence reads at
 * 16.36. Pooling short clips therefore understates the rate for the sentences that narration slots
 * actually contain, and the estimate ran long.
 *
 * Checked against four real renders whose true durations are known. Predicting from text alone
 * (measured audio stripped), the old constants over-estimated by +5.2%, +7.3%, +7.3% and +19.6% —
 * and the +19.6% case was the Hindi project, the one language whose rate was admittedly a guess.
 *
 * Japanese is ~3x slower per character because each kana is a full mora where a Latin character is
 * a fraction of a phoneme. Estimating both at one rate — the obvious mistake — would put a
 * Japanese-heavy video out by a factor of three.
 *
 * These are rates at the reference speaking rate; `charsPerSecond()` scales them linearly, which
 * matches how Google's speakingRate behaves closely enough for planning.
 */
export const SPEECH_RATES: Record<NarrationLang, { charsPerSecond: number; referenceRate: number }> = {
  en: { charsPerSecond: 16.3, referenceRate: 1.0 },
  hi: { charsPerSecond: 14.29, referenceRate: 1.0 },
  hinglish: { charsPerSecond: 15.45, referenceRate: 1.0 },
  ja: { charsPerSecond: 4.91, referenceRate: 0.9 },
};

/** Average characters per English word, for turning a character budget into a word count the
 * model can actually follow. Measured across the existing narration: 767 chars / ~139 words. */
const CHARS_PER_WORD = 5.5;

export function charsPerSecond(lang: NarrationLang, rate: number): number {
  const spec = SPEECH_RATES[lang];
  return spec.charsPerSecond * (rate / spec.referenceRate);
}

/** Seconds of audio a string of this language will take at this rate. */
export function estimateSpeechSeconds(text: string, lang: NarrationLang, rate: number): number {
  if (!text.trim()) return 0;
  return text.trim().length / charsPerSecond(lang, rate);
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PACING: PacingConfig = {
  secondsPerItem: 12,
  repeatJapanese: 2,
  pauseAfterJapaneseSeconds: 1.2,
  scenePaddingSeconds: 0.45,
  japaneseRate: 0.85,
  narrationRate: 1.0,
  // Overridden per content kind below — the skeletons used different hardcoded caps, and a single
  // flat default here would silently shorten every kanji and grammar video.
  examplesPerItem: 2,
};

/**
 * How long one item of each kind deserves.
 *
 * A vocabulary word is a word: say it, mean it, use it, move on. A grammar pattern needs the
 * form, when to use it, and two or three worked examples — cramming that into the same 10
 * seconds is what produced the unusable 60-second target. A curriculum lesson is a lesson.
 */
/**
 * Chosen to be ACHIEVABLE, not aspirational.
 *
 * Each of these sits above `minimumSecondsPerItem` for its typical content, because a budget
 * below the minimum is silently clamped and then over-runs — which is exactly the failure the
 * pacing engine exists to prevent. A vocabulary word spoken twice with a shadowing pause after
 * each, plus an example sentence, simply cannot fit in ten seconds; asking for ten and getting
 * sixteen is worse than asking for sixteen.
 */
export const SECONDS_PER_ITEM_BY_KIND: Record<string, number> = {
  vocabulary: 16,
  kanji: 22,
  grammar: 32,
  sounds: 14,
  writing: 30,
  reading: 40,
  listening: 35,
  conversation: 30,
  study_guide: 45,
  practice_test: 30,
  lesson: 45,
};

/**
 * The same table for Shorts, roughly 55% of the lesson budget.
 *
 * Not a free choice — it is bounded on both sides. Below it, `minimumSecondsPerItem()` already
 * refuses budgets that cannot fit the Japanese plus its shadowing pauses, so cutting further would
 * be silently clamped rather than honoured. Above it, an item split across three beats at lesson
 * budget produces a 45-second "Short", and committing instantly is the format's whole advantage.
 *
 * Vocabulary at 9s across three beats puts each beat near 3s, which is the pace the reference
 * Reels cut at.
 */
export const SHORTS_SECONDS_PER_ITEM_BY_KIND: Record<string, number> = {
  vocabulary: 9,
  kanji: 13,
  grammar: 16,
  sounds: 8,
  writing: 15,
  reading: 20,
  listening: 18,
  conversation: 16,
  study_guide: 20,
  practice_test: 15,
  lesson: 20,
};

/**
 * Per-kind example caps, preserving exactly what each skeleton hardcoded before this was a knob:
 * kanji sliced to 2, grammar to 3, everything else to 2. Getting this wrong is not cosmetic — a
 * flat default would have quietly cut a third of the content out of every grammar video, and
 * nothing would have failed.
 *
 * Shorts take one regardless: three example sentences in a nine-second budget is not a Short.
 */
const EXAMPLES_PER_ITEM_BY_KIND: Record<string, number> = { kanji: 2, grammar: 3 };

/**
 * How pacing changes with JLPT level.
 *
 * Level used to change NOTHING in generation — it was display text, a database filter and one line
 * in the prompt, so an N1 video really was an N5 video with harder words in it. Pacing keyed on
 * content kind alone.
 *
 * The shape of the adjustment: a beginner needs to hear a word more times and needs longer to say
 * it back; an advanced learner does not, and padding their video with repetition is condescending
 * as well as slow. So repeats fall and pauses shorten as the level rises.
 *
 * Multipliers rather than absolute values, so a template that deliberately sets three repeats for a
 * drill still gets a drill at every level — the level shifts it, it does not overwrite it.
 */
const LEVEL_PACING: Record<string, { repeatDelta: number; pauseFactor: number; secondsFactor: number }> = {
  N5: { repeatDelta: +1, pauseFactor: 1.25, secondsFactor: 1.15 },
  N4: { repeatDelta: 0, pauseFactor: 1.1, secondsFactor: 1.05 },
  N3: { repeatDelta: 0, pauseFactor: 1.0, secondsFactor: 1.0 },
  N2: { repeatDelta: -1, pauseFactor: 0.85, secondsFactor: 0.95 },
  N1: { repeatDelta: -1, pauseFactor: 0.7, secondsFactor: 0.9 },
};

export function levelPacing(base: PacingConfig, jlptLevel: string | null | undefined): PacingConfig {
  const rule = LEVEL_PACING[(jlptLevel ?? "").toUpperCase()];
  if (!rule) return base;
  const repeat = Math.max(1, Math.min(3, base.repeatJapanese + rule.repeatDelta)) as 1 | 2 | 3;
  return {
    ...base,
    repeatJapanese: repeat,
    // Rounded to a tenth: these end up in TTS timing and in the UI, and 1.2000000000000002 reads
    // as a bug in both.
    pauseAfterJapaneseSeconds: Math.round(base.pauseAfterJapaneseSeconds * rule.pauseFactor * 10) / 10,
    secondsPerItem: Math.round(base.secondsPerItem * rule.secondsFactor),
  };
}

export function defaultPacingFor(kind: string | undefined, preset: VideoStylePreset = "lesson"): PacingConfig {
  const shorts = preset === "shorts";
  const table = shorts ? SHORTS_SECONDS_PER_ITEM_BY_KIND : SECONDS_PER_ITEM_BY_KIND;
  return {
    ...DEFAULT_PACING,
    secondsPerItem: table[kind ?? ""] ?? (shorts ? 7 : DEFAULT_PACING.secondsPerItem),
    // Repeating a whole sentence twice is tedious; repeating a single word twice is how it sticks.
    // Kept for Shorts too: hearing the word twice is the highest-value second in the video, so the
    // shadowing pause shortens instead.
    repeatJapanese: kind === "vocabulary" || kind === "kanji" ? 2 : 1,
    pauseAfterJapaneseSeconds: shorts ? 0.6 : DEFAULT_PACING.pauseAfterJapaneseSeconds,
    scenePaddingSeconds: shorts ? 0.25 : DEFAULT_PACING.scenePaddingSeconds,
    examplesPerItem: shorts ? 1 : EXAMPLES_PER_ITEM_BY_KIND[kind ?? ""] ?? 2,
  };
}

/** Fills gaps in a partial config from the per-kind defaults, so a project saved before a field
 * existed still resolves. */
export function resolvePacing(
  stored: Partial<PacingConfig> | null | undefined,
  kind?: string,
  preset: VideoStylePreset = "lesson"
): PacingConfig {
  return { ...defaultPacingFor(kind, preset), ...(stored ?? {}) };
}

// ---------------------------------------------------------------------------
// Budgets — what the model is allowed to write
// ---------------------------------------------------------------------------

/**
 * How a per-item second budget is split across that item's narration slots.
 *
 * The Japanese audio, the repeats and the shadowing pauses are fixed costs we compute exactly.
 * Whatever remains is the English explanation's budget — which is the only part the model
 * controls, and therefore the only part worth expressing as a word limit.
 */
export interface SlotBudget {
  id: string;
  hint: string;
  maxWords: number;
  /** Seconds this slot is expected to occupy, for the estimate. */
  seconds: number;
}

export interface ItemBudgetInput {
  pacing: PacingConfig;
  /** Japanese that will be spoken for this item, so its cost can be subtracted first. */
  japaneseText: string[];
  /** How many narration slots the model has to fill for this item. */
  slotCount: number;
}

/**
 * Seconds available to the narrator for one item, after the parts we control exactly.
 *
 * Returns at least a small floor: a slot budget of zero would make the model write nothing, and
 * a silent card is worse than a slightly-over-budget one.
 */
export function narrationSecondsForItem(input: ItemBudgetInput): number {
  return Math.max(MIN_NARRATION_SECONDS, input.pacing.secondsPerItem - fixedSecondsForItem(input));
}

/** Floor per item. A slot budget of zero would make the model write nothing, and a silent card
 * is worse than a slightly-over-budget one. */
const MIN_NARRATION_SECONDS = 2.5;

/**
 * The part of an item's time we control exactly: the Japanese audio, its repeats, the shadowing
 * pauses and the scene padding. Whatever is left over is the narrator's.
 */
export function fixedSecondsForItem(input: ItemBudgetInput): number {
  const { pacing, japaneseText } = input;
  const japaneseSeconds = japaneseText.reduce(
    (sum, text) => sum + estimateSpeechSeconds(text, "ja", pacing.japaneseRate),
    0
  );
  // One pause per phrase, not one per repetition: the repeats play back to back and only the
  // last is followed by the learner's turn to speak.
  return (
    japaneseSeconds * pacing.repeatJapanese +
    japaneseText.length * pacing.pauseAfterJapaneseSeconds +
    pacing.scenePaddingSeconds
  );
}

/**
 * The shortest an item can honestly be at this configuration.
 *
 * Asking for 6 seconds per vocabulary word when the word is spoken twice with a 1.2s pause after
 * each and an example sentence follows is not a target, it is a wish. The wizard surfaces this
 * so the number you type is either achievable or visibly corrected — silently clamping and then
 * over-running is how "60 seconds" became 121 in the first place.
 */
export function minimumSecondsPerItem(input: ItemBudgetInput): number {
  const narratorFloor = Math.max(MIN_NARRATION_SECONDS, input.slotCount * secondsForWords(6, "en", input.pacing.narrationRate));
  return fixedSecondsForItem(input) + narratorFloor;
}

/** Turns a seconds budget into the word limit stated in the prompt. */
export function wordsForSeconds(seconds: number, lang: NarrationLang, rate: number): number {
  return Math.max(6, Math.round((seconds * charsPerSecond(lang, rate)) / CHARS_PER_WORD));
}

/** The inverse: how long a slot of this many words will take to speak. Used to estimate a
 * storyboard before the model has written a single word into it. */
export function secondsForWords(words: number, lang: NarrationLang, rate: number): number {
  return (words * CHARS_PER_WORD) / charsPerSecond(lang, rate);
}

/**
 * Splits an item's narration budget across its slots.
 *
 * Weighted, not equal: the slot that carries the actual explanation deserves more than the one
 * that says "here's an example". Weights come from the caller because only the skeleton builder
 * knows which slot is which.
 */
export function distributeSlotBudget(
  slots: { id: string; hint: string; weight?: number }[],
  totalSeconds: number,
  lang: NarrationLang,
  rate: number
): SlotBudget[] {
  const totalWeight = slots.reduce((sum, s) => sum + (s.weight ?? 1), 0) || 1;
  return slots.map((slot) => {
    const seconds = (totalSeconds * (slot.weight ?? 1)) / totalWeight;
    return { id: slot.id, hint: slot.hint, seconds, maxWords: wordsForSeconds(seconds, lang, rate) };
  });
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export interface DurationEstimate {
  totalSeconds: number;
  narrationSeconds: number;
  japaneseSeconds: number;
  pauseSeconds: number;
  paddingSeconds: number;
  /** True once every segment has real measured audio, i.e. this is no longer an estimate. */
  measured: boolean;
}

/**
 * Estimates a storyboard's length.
 *
 * Uses measured audio wherever the TTS stage has already run and falls back to the speech-rate
 * constants everywhere else, so the same function serves the pre-generation preview, the
 * post-generation review, and the post-render display. `measured` tells the UI which it is —
 * showing an estimate as though it were fact is how "60 seconds" became 121 in the first place.
 */
export function estimateStoryboardDuration(
  scenes: Scene[],
  pacing: PacingConfig,
  /**
   * Seconds budgeted for narration that has not been written yet, keyed by segment id.
   *
   * Without this a pre-generation estimate reports only the Japanese audio and the pauses,
   * because every English segment is still an empty string — which is exactly the wrong
   * direction to be wrong in when the number exists to stop you queueing a video that is twice
   * as long as you asked for.
   */
  plannedSeconds?: Map<string, number>
): DurationEstimate {
  let narrationSeconds = 0;
  let japaneseSeconds = 0;
  let pauseSeconds = 0;
  // Seconds a scene sits on screen beyond what its audio needs, because of minDurationSeconds.
  // Tracked separately so this stays in step with resolveSceneDuration() in timeline.ts — if the
  // estimate ignored the floor, every branded video would render longer than it was forecast to,
  // which is the precise failure this module exists to prevent.
  let floorTopUpSeconds = 0;
  let allMeasured = scenes.length > 0;

  // Scenes whose length a human or the builder fixed outright, which the timeline honours
  // verbatim and without padding (see resolveSceneDuration). Counted separately so the estimate
  // matches the render: a 2.5s mascot intro carrying no narration would otherwise contribute
  // only its padding, and every branded video would run two seconds longer than forecast.
  let fixedSeconds = 0;
  let autoSceneCount = 0;

  for (const scene of scenes) {
    if (scene.durationMode === "fixed") {
      fixedSeconds += Math.max(scene.durationSeconds, 1 / 30);
      continue;
    }
    autoSceneCount += 1;

    let sceneSeconds = 0;

    for (const segment of scene.narration) {
      const measured = segment.audio?.durationSeconds;
      if (measured === undefined) allMeasured = false;

      const rate = segment.lang === "ja" ? pacing.japaneseRate : pacing.narrationRate;
      const text = segment.spokenAs || segment.text;
      const seconds =
        measured ??
        (text.trim() ? estimateSpeechSeconds(text, segment.lang, rate) : plannedSeconds?.get(segment.id) ?? 0);

      if (segment.lang === "ja") japaneseSeconds += seconds;
      else narrationSeconds += seconds;

      const pause = (segment.leadInSeconds ?? 0) + (segment.pauseAfterSeconds ?? 0);
      pauseSeconds += pause;
      sceneSeconds += seconds + pause;
    }

    const floor = scene.minDurationSeconds ?? 0;
    if (floor > 0) {
      floorTopUpSeconds += Math.max(0, floor - (sceneSeconds + pacing.scenePaddingSeconds));
    }
  }

  // Only auto scenes get padding — the timeline adds none to a fixed one.
  const paddingSeconds = autoSceneCount * pacing.scenePaddingSeconds;
  return {
    totalSeconds:
      narrationSeconds + japaneseSeconds + pauseSeconds + paddingSeconds + floorTopUpSeconds + fixedSeconds,
    narrationSeconds,
    japaneseSeconds,
    pauseSeconds,
    paddingSeconds,
    measured: allMeasured,
  };
}

/** Rough total before a script exists — used by the wizard's estimate panel. */
export function estimateProjectDuration(snapshot: ContentSnapshot, pacing: PacingConfig): number {
  // Intro and outro are roughly one item's worth between them.
  const chrome = pacing.secondsPerItem * 0.8;
  return snapshot.items.length * pacing.secondsPerItem + chrome;
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/** Google Cloud TTS, USD per million characters. Both tiers include 1M chars/month free. */
const TTS_PRICE_PER_MILLION: Record<string, number> = { Neural2: 16, Wavenet: 16, Chirp: 30, Standard: 4, Studio: 160 };

export function ttsPricePerMillion(voiceName: string): number {
  for (const [tier, price] of Object.entries(TTS_PRICE_PER_MILLION)) {
    if (voiceName.includes(tier)) return price;
  }
  return TTS_PRICE_PER_MILLION.Neural2;
}

export function estimateTtsCost(scenes: Scene[], voices: Partial<Record<NarrationLang, string>>): number {
  let cost = 0;
  for (const scene of scenes) {
    for (const segment of scene.narration) {
      // A cached segment costs nothing to re-render, which is why editing visuals is free.
      if (segment.audio) continue;
      const voice = segment.voice ?? voices[segment.lang] ?? "Neural2";
      const chars = (segment.spokenAs || segment.text).length;
      cost += (chars / 1_000_000) * ttsPricePerMillion(voice);
    }
  }
  return cost;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
