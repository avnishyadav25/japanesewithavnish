/**
 * Blank scenes for the editor's "insert" action.
 *
 * WHICH TYPES ARE OFFERED, AND WHY NOT THE REST. A scene is only insertable by hand if its visual
 * is plain text a person can type. Three groups are deliberately excluded:
 *
 *   kanji_stroke / kana_grid   `strokePaths` is KanjiVG path data from `kanji.stroke_data`. There
 *                              is nothing sensible to type, and an empty array renders a blank box.
 *   broll_page                 `asset` is filled by the worker after a Playwright capture.
 *   listening_prompt           `audioUrl` points at existing audio in the content database.
 *   vocab_card / example_...   Authorable in principle, but they carry Japanese — readings and
 *                              example sentences — which this pipeline sources from the database
 *                              rather than from anyone's memory, precisely so a wrong reading
 *                              cannot be burned into a video.
 *
 * What is left is commentary: headings, callouts, comparisons, recaps, quizzes. Those are the
 * scenes a human actually wants to add to a generated script.
 */
import type { NarrationLang, Scene, SceneType } from "./types";

/**
 * A scene id, generated without importing storyboard.ts.
 *
 * storyboard.ts reaches src/lib/db through load-prompts, which pulls `pg` and therefore `fs` into
 * whatever bundle imports it. This module's constants are used by the editor — a client component
 * — so importing newSceneId() from there broke the production build with "Can't resolve 'fs'".
 * Web Crypto's randomUUID is available in both Node 19+ and every modern browser, so this module
 * stays isomorphic and imports nothing but types.
 */
function sceneId(): string {
  return `sc-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

export const INSERTABLE_SCENE_TYPES = [
  "title_card",
  "tip_callout",
  "common_mistake",
  "culture_note",
  "comparison",
  "summary_recap",
  "quiz_question",
] as const;

export type InsertableSceneType = (typeof INSERTABLE_SCENE_TYPES)[number];

export function isInsertable(t: string): t is InsertableSceneType {
  return (INSERTABLE_SCENE_TYPES as readonly string[]).includes(t);
}

export const INSERTABLE_SCENE_LABELS: Record<InsertableSceneType, string> = {
  title_card: "Title card — a heading between sections",
  tip_callout: "Tip — a short piece of advice",
  common_mistake: "Common mistake — what learners get wrong",
  culture_note: "Culture note — context beyond the language",
  comparison: "Comparison — two things side by side",
  summary_recap: "Recap — the points so far",
  quiz_question: "Quiz — a question with options",
};

/**
 * A scene that renders correctly the moment it is inserted.
 *
 * Every placeholder is real text rather than an empty string: an empty visual renders as a blank
 * card, which looks like a bug rather than like something waiting to be filled in.
 *
 * The narration segment is empty on purpose — "regenerate this scene" fills it, and until then the
 * scene is `durationMode: "fixed"` so a silent scene still holds the screen for a sensible time
 * instead of collapsing to the minimum.
 */
export function blankScene(sceneType: InsertableSceneType, lang: NarrationLang): Scene {
  const id = sceneId();
  const narrationId = `${id}-nar`;

  const visual = (() => {
    switch (sceneType) {
      case "title_card":
        return { sceneType, title: "New section", subtitle: undefined };
      case "comparison":
        return {
          sceneType,
          heading: "A or B?",
          left: { label: "A", points: ["First point"] },
          right: { label: "B", points: ["First point"] },
        };
      case "summary_recap":
        return { sceneType, heading: "Recap", points: ["First point", "Second point"] };
      case "quiz_question":
        return {
          sceneType,
          question: "Which one is correct?",
          options: ["First", "Second"],
          correctIndex: 0,
          thinkingSeconds: 3,
        };
      default:
        // tip_callout / common_mistake / culture_note all share CalloutVisual.
        return { sceneType, heading: "Heading", body: "Write the point here." };
    }
  })();

  return {
    id,
    sceneType: sceneType as SceneType,
    durationMode: "fixed",
    durationSeconds: 6,
    transitionIn: { kind: "fade", durationSeconds: 0.3 },
    narration: [{ id: narrationId, text: "", lang }],
    visual: visual as Scene["visual"],
  };
}
