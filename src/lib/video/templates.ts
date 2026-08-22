/**
 * What a format IS, as data rather than as a branch in the generator.
 *
 * This is the first slice of the template architecture (roadmap 6.9/6.10), extracted while building
 * the format that needs it rather than as a speculative refactor. Nothing is rewritten: the
 * skeletons still build the scenes. A template only says how many items a video covers, how it is
 * paced, and whether it ends with a recall round.
 *
 * WHY DATA. The alternative was another `if (format === "longform25")` inside storyboard.ts, which
 * already dispatches on content kind and on style preset. A third axis of branching in the file
 * every format depends on is how that file becomes unmaintainable.
 *
 * ONE RULE, learned from this codebase: every field here must demonstrably change the output.
 * Four declared-and-ignored fields already exist — `Scene.pacingOverride`,
 * `VocabListVisual.highlightSchedule`, `BLOCK_TYPE_TO_SCENE`, and `QuizQuestionVisual.thinkingSeconds`
 * until it was fixed alongside this file. Configuration that silently does nothing is worse than no
 * configuration, because it reads as working.
 */
import type { PacingConfig, VideoStylePreset } from "./types";
import type { MotionProfile } from "./motion";

export interface RecallConfig {
  /**
   * Seconds the viewer gets to answer before the reveal. Honoured by QuizQuestionScene via
   * `thinkingSeconds` — which was inert until this format needed it.
   */
  thinkingSeconds: number;
  /**
   * `ja_to_en` shows the Japanese and reveals the meaning, matching how the teaching half presented
   * it. Recognition, not production.
   */
  direction: "ja_to_en";
  /** Cap on questions. 0 or absent means every item taught, which is what makes it a study unit. */
  maxQuestions?: number;
}

export interface VideoTemplate {
  id: string;
  label: string;
  /** The content kind this applies to — matches `ContentItem.kind`. */
  contentType: string;
  stylePreset: VideoStylePreset;
  /**
   * Motion profile. Omitted, the style preset's own is used — which is what keeps every existing
   * lesson frame-identical while a new format opts into movement.
   */
  motionProfile?: MotionProfile;
  /** How many items one video covers. The unit that makes a series repeatable. */
  itemsPerVideo: number;
  /** Overrides on top of `defaultPacingFor(contentType, stylePreset)`. */
  pacing: Partial<PacingConfig>;
  recall?: RecallConfig;
  /** Shown in the wizard so the choice explains itself. */
  description: string;
}

/**
 * The long-form vocabulary drill.
 *
 * 25 words, each spoken three times with a two-second gap to say it back, then a recall round over
 * all 25. Roughly nine minutes — a study unit rather than a clip.
 *
 * The repeat and pause numbers need no new machinery: `repeatJapanese` has always been typed
 * `1 | 2 | 3` and the pause is a plain number of seconds. They were simply never defaulted this way,
 * because 2 repeats and 1.2s suits a mixed lesson and this format is a drill.
 */
export const VIDEO_TEMPLATES: Record<string, VideoTemplate> = {
  "vocabulary-drill-25": {
    id: "vocabulary-drill-25",
    label: "Vocabulary drill (25 words + recall)",
    contentType: "vocabulary",
    stylePreset: "lesson",
    // Long-form that moves. A 16-second teaching scene finishes every entrance by frame 40 and
    // then holds a still image; `teaching` is half the Shorts camera, which is enough to keep the
    // frame alive without competing with the word, reading, meaning and example on it.
    motionProfile: "teaching",
    itemsPerVideo: 25,
    pacing: {
      repeatJapanese: 3,
      pauseAfterJapaneseSeconds: 2,
      // One example keeps 25 words near nine minutes. Two would push it past twelve, and only 12%
      // of vocabulary has a second example anyway.
      examplesPerItem: 1,
    },
    recall: { thinkingSeconds: 2, direction: "ja_to_en" },
    description:
      "25 words, each said three times with a gap to repeat it back, then a recall round over all 25. About nine minutes.",
  },

  /**
   * The same shape for kanji and grammar (roadmap 6.7), with each subject's own unit.
   *
   * Not 25 across the board. A kanji needs stroke order, readings and example words, and a grammar
   * point needs a pattern, when to use it and examples — both are several times the screen time of
   * a vocabulary word, so 25 of either is a very long video nobody finishes.
   *
   * MEASURED, not guessed, and the first numbers here were wrong: at N5 these come out at 5.5 and
   * 5.6 minutes against the vocabulary drill's 8.4. Lengths vary by level, because higher levels
   * carry more readings and longer examples — these units are tuned for N5, which is where the
   * series starts.
   */
  "kanji-drill-12": {
    id: "kanji-drill-12",
    label: "Kanji drill (12 characters + recall)",
    contentType: "kanji",
    stylePreset: "lesson",
    motionProfile: "teaching",
    itemsPerVideo: 12,
    pacing: { repeatJapanese: 2, pauseAfterJapaneseSeconds: 2, examplesPerItem: 1 },
    recall: { thinkingSeconds: 2, direction: "ja_to_en" },
    description: "12 characters with stroke order and readings, then a recall round. About 5-6 minutes at N5.",
  },

  "grammar-drill-8": {
    id: "grammar-drill-8",
    label: "Grammar drill (8 patterns + recall)",
    contentType: "grammar",
    stylePreset: "lesson",
    motionProfile: "teaching",
    itemsPerVideo: 8,
    // Grammar is the one content type with examples to spare — 4.4 on average, and 67% have two or
    // more, against 12% of vocabulary. This is the one place raising the example count does work.
    pacing: { repeatJapanese: 1, pauseAfterJapaneseSeconds: 1.5, examplesPerItem: 3 },
    recall: { thinkingSeconds: 3, direction: "ja_to_en" },
    description: "8 patterns with three examples each, then a recall round. About 5-6 minutes at N5.",
  },

  /**
   * Shorts, at two scopes on purpose (roadmap 6.6).
   *
   * One word is the discovery firehose — ~22 seconds, the whole published vocabulary is a thousand
   * of them. Five words is a "5 a day" series at around a minute, long enough to be worth
   * subscribing to and short enough to finish. They are different jobs, so both exist rather than
   * one replacing the other.
   */
  /**
   * Reading and listening (roadmap 6.7's "coherent learning system"), now that both have skeletons.
   *
   * Their components — an auto-scrolling passage, a countdown-and-reveal listening prompt — have
   * existed since the first version and were generated by nothing; reading and listening content
   * fell through to the generic skeleton, which narrates a title and a summary and shows neither
   * the passage nor plays the clip.
   */
  "reading-practice-3": {
    id: "reading-practice-3",
    label: "Reading practice (3 passages)",
    contentType: "reading",
    stylePreset: "lesson",
    motionProfile: "teaching",
    itemsPerVideo: 3,
    // No shadowing pause: the learner is reading along, not repeating, and a gap after every
    // sentence would break the flow of a passage.
    pacing: { repeatJapanese: 1, pauseAfterJapaneseSeconds: 0.4 },
    description: "3 passages read aloud sentence by sentence, each followed by its meaning.",
  },

  "listening-practice-6": {
    id: "listening-practice-6",
    label: "Listening practice (6 clips)",
    contentType: "listening",
    stylePreset: "lesson",
    motionProfile: "teaching",
    itemsPerVideo: 2,
    pacing: { repeatJapanese: 2, pauseAfterJapaneseSeconds: 0.5, examplesPerItem: 6 },
    // The thinking window is the whole exercise here, so it is longer than a vocabulary recall.
    recall: { thinkingSeconds: 4, direction: "ja_to_en" },
    description: "Hear a line, pause to work it out, then see it written with its meaning.",
  },

  "vocabulary-short-1": {
    id: "vocabulary-short-1",
    label: "Short — one word",
    contentType: "vocabulary",
    stylePreset: "shorts",
    itemsPerVideo: 1,
    pacing: {},
    description: "One word in about 22 seconds. The high-volume discovery format.",
  },

  "vocabulary-short-5": {
    id: "vocabulary-short-5",
    label: "Short — five a day",
    contentType: "vocabulary",
    stylePreset: "shorts",
    itemsPerVideo: 5,
    // No recall round: at five words the video IS the review, and a quiz would double its length
    // past what a Reel holds.
    pacing: {},
    description: "Five words in about 70 seconds. A daily series that points at the full lesson.",
  },
};

export function templateById(id: string | null | undefined): VideoTemplate | null {
  return id ? VIDEO_TEMPLATES[id] ?? null : null;
}

export function templatesFor(contentType: string): VideoTemplate[] {
  return Object.values(VIDEO_TEMPLATES).filter((t) => t.contentType === contentType);
}
