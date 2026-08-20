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
};

export function templateById(id: string | null | undefined): VideoTemplate | null {
  return id ? VIDEO_TEMPLATES[id] ?? null : null;
}

export function templatesFor(contentType: string): VideoTemplate[] {
  return Object.values(VIDEO_TEMPLATES).filter((t) => t.contentType === contentType);
}
