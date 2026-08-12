/**
 * Video Studio — the storyboard contract.
 *
 * This file is the single interface between four consumers that never talk to each other
 * directly: the DeepSeek script generator, the admin storyboard/timeline editor, the Remotion
 * compositions, and the render worker. Changing a shape here changes all four.
 *
 * Import discipline: type-only imports only, and nothing from `next/*`. The worker
 * (scripts/video-worker.ts) imports this by relative path under plain tsx, outside Next.
 */
// Relative rather than "@/lib/blocks/blockTypes" so the render worker (plain tsx, no Next
// resolver) can import this module by path. See the note in ./tts.ts.
import type { BlockType } from "../blocks/blockTypes";

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

export type VideoFormat = "vertical" | "landscape" | "square" | "embed";

export const VIDEO_FORMATS: VideoFormat[] = ["vertical", "landscape", "square", "embed"];

export interface FormatSpec {
  width: number;
  height: number;
  fps: number;
  label: string;
  /** Which layout branch scene components take. `embed` shares landscape's branch. */
  layout: "vertical" | "landscape" | "square";
}

/** One storyboard renders to every format by swapping these dimensions — the storyboard itself
 * carries no geometry. Scene components read the layout and pick a variant. */
export const FORMAT_SPECS: Record<VideoFormat, FormatSpec> = {
  vertical: { width: 1080, height: 1920, fps: 30, label: "Vertical 9:16 (Shorts/Reels/TikTok)", layout: "vertical" },
  landscape: { width: 1920, height: 1080, fps: 30, label: "Landscape 16:9 (YouTube)", layout: "landscape" },
  square: { width: 1080, height: 1080, fps: 30, label: "Square 1:1 (Instagram feed)", layout: "square" },
  embed: { width: 1280, height: 720, fps: 30, label: "Embed 16:9 (on-site player)", layout: "landscape" },
};

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

/** The language the *explanation* is in. Japanese terms inside a scene are always spoken by a
 * native ja-JP voice regardless of this, via per-segment `lang`. */
export type NarrationLang = "en" | "hi" | "ja";

export const NARRATION_LANGS: NarrationLang[] = ["en", "hi", "ja"];

export const NARRATION_LANG_LABELS: Record<NarrationLang, string> = {
  en: "English narration",
  hi: "Hindi narration",
  ja: "Japanese immersion (subtitled)",
};

export interface NarrationSegment {
  /** Stable across edits. Caption cues and per-segment audio are keyed off this. */
  id: string;
  /** What the LLM writes. For `lang: "ja"` segments prefer supplying `spokenAs` too. */
  text: string;
  lang: NarrationLang;
  /**
   * Overrides `text` for synthesis only; `text` is still what appears in captions.
   *
   * This is the fix for Google's ja-JP voices misreading kanji with multiple readings —
   * 「行った」 is いった or おこなった depending on context and the voice guesses. Our schema
   * already has the answer (`vocabulary.reading`, `kanji.onyomi`/`kunyomi`,
   * `examples.sentence_romaji`), so the storyboard builder puts the kana reading here and the
   * pronunciation is correct by construction rather than by luck.
   */
  spokenAs?: string;
  /** Overrides the theme default for this segment's language. */
  voice?: string;
  speakingRate?: number;
  pitch?: number;
  /** Silence inserted before this segment, for pacing against an on-screen beat. */
  leadInSeconds?: number;
  /** Built by the TTS layer from text/spokenAs — never authored by the LLM or a human. */
  ssml?: string;
  /** Filled in by the worker's `tts` stage. Absent until then. */
  audio?: {
    url: string;
    durationSeconds: number;
    ttsAssetId: string;
  };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export type SceneType =
  | "title_card"
  | "vocab_card"
  | "vocab_list"
  | "kanji_stroke"
  | "kanji_detail"
  | "kana_grid"
  | "grammar_pattern"
  | "grammar_formation"
  | "example_sentence"
  | "dialogue"
  | "reading_passage"
  | "listening_prompt"
  | "comparison"
  | "tip_callout"
  | "common_mistake"
  | "culture_note"
  | "quiz_question"
  | "summary_recap"
  | "broll_page"
  | "cta_outro";

export const SCENE_TYPES: SceneType[] = [
  "title_card", "vocab_card", "vocab_list", "kanji_stroke", "kanji_detail", "kana_grid",
  "grammar_pattern", "grammar_formation", "example_sentence", "dialogue", "reading_passage",
  "listening_prompt", "comparison", "tip_callout", "common_mistake", "culture_note",
  "quiz_question", "summary_recap", "broll_page", "cta_outro",
];

/** Maps each of the 36 block types in src/lib/blocks/blockTypes.ts onto a scene. `null` means
 * the block carries no independently filmable content (prose that the narration already
 * covers) — the generator folds it into neighbouring narration instead of emitting a scene. */
export const BLOCK_TYPE_TO_SCENE: Record<BlockType, SceneType | null> = {
  section_heading: "title_card",
  next_lesson: "cta_outro",
  rich_text: null,
  resource_link: null,
  vocabulary_set: "vocab_list",
  related_words: "vocab_list",
  collocations: "vocab_list",
  kanji_focus: "kanji_stroke",
  writing_canvas: "kanji_stroke",
  kanji_radicals: "kanji_detail",
  similar_kanji: "kanji_detail",
  kana_character: "kana_grid",
  kana_grid: "kana_grid",
  grammar_rule: "grammar_pattern",
  nuance: "grammar_pattern",
  register: "grammar_pattern",
  when_not_to_use: "grammar_pattern",
  grammar_formation: "grammar_formation",
  example_set: "example_sentence",
  japanese_learning_text: "example_sentence",
  dialogue: "dialogue",
  speaking_prompt: "dialogue",
  reading_passage: "reading_passage",
  audio: "listening_prompt",
  pronunciation: "listening_prompt",
  comprehension_question: "listening_prompt",
  comparison: "comparison",
  tip: "tip_callout",
  memory_aid: "tip_callout",
  action_plan: "tip_callout",
  common_mistake: "common_mistake",
  culture_note: "culture_note",
  checkpoint: "quiz_question",
  writing_prompt: "quiz_question",
  summary: "summary_recap",
};

export type TransitionKind = "none" | "fade" | "slide" | "wipe" | "kenburns";

export interface Transition {
  kind: TransitionKind;
  durationSeconds: number;
}

export interface SourceRef {
  kind: "post" | "lesson" | "kanji" | "kana" | "vocabulary" | "grammar" | "block";
  id: string;
  blockType?: BlockType;
  /** Public URL of the page this content lives on — the B-roll capturer and the CTA use it. */
  url?: string;
}

export interface Scene {
  /** Stable across edits and re-versioning. Reordering must NOT change it: TTS cache hits and
   * the timeline editor's selection state both key off scene id. */
  id: string;
  sceneType: SceneType;
  sourceRef?: SourceRef;
  /**
   * `auto` (the default) means the worker overwrites `durationSeconds` with the measured
   * narration length plus theme padding. `fixed` means a human dragged the clip edge in the
   * timeline editor and their value wins.
   */
  durationMode: "auto" | "fixed";
  /** Seconds. An authored hint in `auto` mode; authoritative in `fixed` mode. */
  durationSeconds: number;
  transitionIn: Transition;
  narration: NarrationSegment[];
  visual: VisualSpec;
  /** Admin-only. Never rendered, never spoken. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Visual specs — discriminated on `sceneType`
// ---------------------------------------------------------------------------

export interface TitleCardVisual {
  sceneType: "title_card";
  title: string;
  subtitle?: string;
  eyebrow?: string;
  jlptLevel?: string;
}

export interface VocabItem {
  word: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  partOfSpeech?: string;
  transitivity?: string;
  example?: ExampleSentence;
}

export interface ExampleSentence {
  ja: string;
  romaji?: string;
  en: string;
  /** Kana reading of the whole sentence, when known — used for synthesis, not display. */
  readingKana?: string;
}

export interface VocabCardVisual {
  sceneType: "vocab_card";
  item: VocabItem;
  /** Index/total drive the "3 / 10" counter and the progress bar on shorts. */
  index?: number;
  total?: number;
  showFurigana: boolean;
}

export interface VocabListVisual {
  sceneType: "vocab_list";
  heading?: string;
  items: VocabItem[];
  /** Which item is emphasised at each point, as [itemIndex, atSecond] pairs. */
  highlightSchedule?: [number, number][];
}

export interface KanjiStrokeVisual {
  sceneType: "kanji_stroke";
  character: string;
  meaning: string;
  meaningExtended?: string;
  onyomi: string[];
  kunyomi: string[];
  strokeCount?: number;
  /** KanjiVG path data straight out of `kanji.stroke_data` / `kana.stroke_data` (109x109
   * viewBox), rendered the same way as src/components/learn/WritingCanvas.tsx. */
  strokePaths: string[];
  exampleWords?: VocabItem[];
}

export interface KanjiDetailVisual {
  sceneType: "kanji_detail";
  character: string;
  meaning: string;
  radicals?: { character: string; meaning: string }[];
  similar?: { character: string; meaning: string; distinction: string }[];
  mnemonic?: string;
}

export interface KanaGridVisual {
  sceneType: "kana_grid";
  kind: "hiragana" | "katakana";
  rowLabel?: string;
  characters: { character: string; romaji: string; strokePaths?: string[] }[];
  focusIndex?: number;
}

export interface GrammarPatternVisual {
  sceneType: "grammar_pattern";
  pattern: string;
  reading?: string;
  meaning: string;
  structure?: string;
  level?: string;
  whenToUse?: string;
  caution?: string;
}

export interface GrammarFormationVisual {
  sceneType: "grammar_formation";
  pattern: string;
  /** Each step is one animated build-up beat: 食べる → 食べ → 食べたい */
  steps: { from: string; to: string; rule: string }[];
}

export interface ExampleSentenceVisual {
  sceneType: "example_sentence";
  heading?: string;
  sentences: ExampleSentence[];
  /** Substrings to visually emphasise inside `ja` — the grammar point or target word. */
  highlight?: string[];
}

export interface DialogueVisual {
  sceneType: "dialogue";
  title?: string;
  lines: { speaker: string; ja: string; romaji?: string; en: string; readingKana?: string }[];
}

export interface ReadingPassageVisual {
  sceneType: "reading_passage";
  title?: string;
  passageJa: string;
  passageEn?: string;
  /** Long passages scroll rather than shrink to unreadable type. */
  scroll: boolean;
}

export interface ListeningPromptVisual {
  sceneType: "listening_prompt";
  prompt: string;
  /** Pre-existing audio from listening.audio_url / block payloads, distinct from narration. */
  audioUrl?: string;
  transcriptJa?: string;
  transcriptEn?: string;
  /** Seconds of on-screen countdown before the answer is revealed. */
  thinkingSeconds?: number;
  answer?: string;
}

export interface ComparisonVisual {
  sceneType: "comparison";
  heading?: string;
  left: { label: string; points: string[] };
  right: { label: string; points: string[] };
}

export interface CalloutVisual {
  sceneType: "tip_callout" | "common_mistake" | "culture_note";
  heading: string;
  body: string;
  /** For common_mistake: the wrong form struck through above the right one. */
  wrong?: string;
  right?: string;
}

export interface QuizQuestionVisual {
  sceneType: "quiz_question";
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  thinkingSeconds: number;
}

export interface SummaryRecapVisual {
  sceneType: "summary_recap";
  heading: string;
  points: string[];
}

export interface BrollPageVisual {
  sceneType: "broll_page";
  /** Public URL to capture. Resolved to an asset by the worker's `broll` stage. */
  sourceUrl: string;
  /**
   * `still`           one viewport-sized screenshot
   * `scroll_clip`     one FULL-PAGE (tall) screenshot which Remotion then pans down. Capturing
   *                   a single tall image and animating it beats recording a real scroll: it is
   *                   one browser action instead of ninety, it is frame-deterministic, and the
   *                   pan speed can be retuned later without re-capturing the page.
   * `interaction_clip` a genuinely recorded clip, for choreography a pan cannot fake
   *                   (opening a modal, typing, a hover state).
   */
  captureKind: "still" | "scroll_clip" | "interaction_clip";
  caption?: string;
  /** Filled by the worker once captured. */
  asset?: {
    url: string;
    kind: "image" | "video";
    brollAssetId: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
  };
}

export interface CtaOutroVisual {
  sceneType: "cta_outro";
  headline: string;
  subline?: string;
  /** Shown as text; not a clickable link in a video file. */
  url?: string;
  showLogo: boolean;
}

export type VisualSpec =
  | TitleCardVisual
  | VocabCardVisual
  | VocabListVisual
  | KanjiStrokeVisual
  | KanjiDetailVisual
  | KanaGridVisual
  | GrammarPatternVisual
  | GrammarFormationVisual
  | ExampleSentenceVisual
  | DialogueVisual
  | ReadingPassageVisual
  | ListeningPromptVisual
  | ComparisonVisual
  | CalloutVisual
  | QuizQuestionVisual
  | SummaryRecapVisual
  | BrollPageVisual
  | CtaOutroVisual;

// ---------------------------------------------------------------------------
// The storyboard document
// ---------------------------------------------------------------------------

export interface CaptionSettings {
  enabled: boolean;
  /** Burned into the frame (required for Shorts/Reels) vs. shipped as a sidecar .srt/.vtt. */
  burnIn: boolean;
  style: "bold-center" | "lower-third";
}

export interface BgmSettings {
  trackId: string;
  gainDb: number;
  /** How far the music drops while narration plays. Applied via ffmpeg sidechaincompress. */
  duckDb: number;
}

/**
 * Written back by the worker's `timeline` stage after real audio durations are known. Never
 * authored by hand or by the LLM — if you find yourself setting this in the editor, the
 * duration belongs in `Scene.durationSeconds` with `durationMode: "fixed"` instead.
 */
export interface ResolvedTimeline {
  fps: number;
  totalFrames: number;
  /** Parallel to `scenes`: [startFrame, endFrameExclusive] per scene. */
  sceneFrameSpans: [number, number][];
  /** Flat caption cue list in seconds, for the .srt/.vtt writer and burned-in captions. */
  cues: { start: number; end: number; text: string; lang: NarrationLang }[];
  resolvedAt: string;
}

export interface Storyboard {
  schemaVersion: 1;
  projectId: string;
  title: string;
  narrationLang: NarrationLang;
  themeKey: string;
  bgm?: BgmSettings;
  captions: CaptionSettings;
  scenes: Scene[];
  resolved?: ResolvedTimeline;
}

// ---------------------------------------------------------------------------
// Scope + content snapshot (input to generation)
// ---------------------------------------------------------------------------

export type ScopeKind =
  | "curriculum_level"
  | "curriculum_module"
  | "curriculum_submodule"
  | "curriculum_lesson"
  | "content_batch"
  | "content_item";

export interface ScopeRef {
  levelId?: string;
  moduleId?: string;
  submoduleId?: string;
  lessonId?: string;
  postId?: string;
  contentType?: string;
  jlptLevel?: string;
  tags?: string[];
  limit?: number;
  postIds?: string[];
}

/** Normalised, presentation-ready content handed to the storyboard generator. Built by
 * src/lib/video/scopeResolver.ts, which reuses the existing block resolvers rather than
 * re-querying content by hand. */
export interface ContentSnapshot {
  scopeKind: ScopeKind;
  scopeRef: ScopeRef;
  title: string;
  jlptLevel?: string;
  items: ContentItem[];
}

export interface ContentItem {
  kind: "vocabulary" | "kanji" | "grammar" | "reading" | "listening" | "writing" | "sounds" | "conversation" | "practice_test" | "kana" | "lesson";
  postId?: string;
  slug?: string;
  url?: string;
  title: string;
  summary?: string;
  jlptLevel?: string;
  /** Type-specific payload, shaped by the sidecar tables. */
  data: Record<string, unknown>;
  examples: ExampleSentence[];
  /** Resolved blocks, when the item has any. Already FK-expanded. */
  blocks: { blockType: BlockType; data: Record<string, unknown> }[];
}

// ---------------------------------------------------------------------------
// DB row shapes (what the admin UI and worker read back)
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "draft" | "generating_script" | "script_ready" | "script_pending_review"
  | "queued_render" | "rendering" | "render_ready" | "video_pending_review"
  | "publishing" | "published" | "failed" | "rejected" | "archived";

export type RenderJobStatus = "queued" | "claimed" | "running" | "completed" | "failed" | "cancelled";

export type RenderStage = "tts" | "broll" | "timeline" | "render" | "post" | "upload" | "publish";

export type ApprovalMode = "auto" | "script_gate" | "dual_gate";

export interface VideoProjectRow {
  id: string;
  title: string;
  scopeKind: ScopeKind;
  scopeRef: ScopeRef;
  grouping: "single_video" | "video_per_item";
  themeKey: string;
  bgmTrackId: string | null;
  narrationLangs: NarrationLang[];
  formats: VideoFormat[];
  targetDurationSeconds: number | null;
  tone: string | null;
  includeBroll: boolean;
  status: ProjectStatus;
  currentStoryboardId: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRenderJobRow {
  id: string;
  projectId: string;
  storyboardId: string;
  format: VideoFormat;
  status: RenderJobStatus;
  stage: RenderStage | null;
  progressPct: number;
  log: { at: string; message: string }[];
  runner: string | null;
  runnerId: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  requestedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
}

export interface VideoThemeTokens {
  bg: string;
  surface: string;
  primary: string;
  primaryHover: string;
  accent: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  radius: number;
  fontSans: string;
  fontSerif: string;
  fontJa: string;
}
