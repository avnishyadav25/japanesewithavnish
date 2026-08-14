/**
 * Scene registry — maps a storyboard scene onto its React component.
 *
 * The registry is exhaustive over SceneType (TypeScript enforces it via the Record), so adding
 * a scene type to src/lib/video/types.ts fails the build here until a component exists for it.
 * That is deliberate: a missing scene should be a compile error, not a blank frame discovered
 * after a 20-minute render.
 */
import React from "react";
import type { Scene, SceneType, VisualSpec } from "@/lib/video/types";
import { CalloutScene, CtaOutroScene, SummaryRecapScene, TitleCardScene } from "./TextScenes";
import { MascotIntroScene } from "./MascotScenes";
import {
  ComparisonScene,
  ExampleSentenceScene,
  GrammarFormationScene,
  GrammarPatternScene,
  VocabCardScene,
  VocabListScene,
} from "./LanguageScenes";
import { KanaGridScene, KanjiDetailScene, KanjiStrokeScene } from "./KanjiScenes";
import {
  BrollPageScene,
  DialogueScene,
  ListeningPromptScene,
  QuizQuestionScene,
  ReadingPassageScene,
} from "./MediaScenes";

// Each component narrows `visual` itself via the discriminated union; the registry is typed
// loosely so one Record can hold components with different visual shapes.
type SceneComponent = React.FC<{ visual: never }>;

const REGISTRY: Record<SceneType, SceneComponent> = {
  mascot_intro: MascotIntroScene as SceneComponent,
  title_card: TitleCardScene as SceneComponent,
  vocab_card: VocabCardScene as SceneComponent,
  vocab_list: VocabListScene as SceneComponent,
  kanji_stroke: KanjiStrokeScene as SceneComponent,
  kanji_detail: KanjiDetailScene as SceneComponent,
  kana_grid: KanaGridScene as SceneComponent,
  grammar_pattern: GrammarPatternScene as SceneComponent,
  grammar_formation: GrammarFormationScene as SceneComponent,
  example_sentence: ExampleSentenceScene as SceneComponent,
  dialogue: DialogueScene as SceneComponent,
  reading_passage: ReadingPassageScene as SceneComponent,
  listening_prompt: ListeningPromptScene as SceneComponent,
  comparison: ComparisonScene as SceneComponent,
  tip_callout: CalloutScene as SceneComponent,
  common_mistake: CalloutScene as SceneComponent,
  culture_note: CalloutScene as SceneComponent,
  quiz_question: QuizQuestionScene as SceneComponent,
  summary_recap: SummaryRecapScene as SceneComponent,
  broll_page: BrollPageScene as SceneComponent,
  cta_outro: CtaOutroScene as SceneComponent,
};

export const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const Component = REGISTRY[scene.sceneType];
  if (!Component) return null;
  // The visual's own `sceneType` discriminant is what each component narrows on; the scene's
  // is only used for dispatch.
  return <Component visual={scene.visual as unknown as never} />;
};

export function isKnownSceneType(value: string): value is SceneType {
  return value in REGISTRY;
}

export type { VisualSpec };
