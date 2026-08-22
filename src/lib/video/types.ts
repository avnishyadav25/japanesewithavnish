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
import type { SocialPlatform } from "../brand";

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

export type VideoFormat = "vertical" | "landscape" | "square" | "embed";

/**
 * Which set of pacing and motion rules a project renders under.
 *
 * `lesson` is everything the app did before this existed and is unchanged by design — a five
 * minute grammar explainer is a teaching artefact and cutting it every two seconds makes it worse.
 * `shorts` is the Reel/TikTok register: an item is split into several short beats, the camera
 * never stops moving, captions highlight the spoken word, and the opening hook is spoken rather
 * than mimed.
 *
 * Frozen into the storyboard alongside branding, for the same reason: a re-render must reproduce
 * what was approved rather than whatever the constants say today.
 */
export type VideoStylePreset = "lesson" | "shorts";

export const DEFAULT_STYLE_PRESET: VideoStylePreset = "lesson";

/**
 * A project is a Short when vertical is the ONLY output.
 *
 * Asking for a landscape cut as well means the same storyboard has to serve YouTube, where the
 * beat split reads as chopped up. Mixed formats therefore stay on lesson pacing; render a
 * separate vertical-only project when you want the Short.
 */
/**
 * The most items a vertical video can cover and still be a Short.
 *
 * A SHORT IS A LENGTH, NOT AN ASPECT RATIO. Deciding on format alone produced a 7.4-minute video
 * labelled as a Short — "N5 reading", vertical-only with ten passages — which then generated under
 * Shorts pacing, word captions and beat splitting, none of which suit a ten-item reading video.
 *
 * Five, because the five-word Shorts template lands at ~70 seconds and is the longest thing that
 * still reads as a Short. Six of anything is past a minute for every content type.
 */
export const MAX_SHORTS_ITEMS = 5;

/**
 * `itemCount` omitted keeps the original format-only rule, which is what every caller that has no
 * resolved scope yet must fall back on — the wizard asks this before it knows the item count.
 */
export function stylePresetForFormats(formats: readonly string[], itemCount?: number): VideoStylePreset {
  const verticalOnly = formats.length === 1 && formats[0] === "vertical";
  if (!verticalOnly) return "lesson";
  if (itemCount !== undefined && itemCount > MAX_SHORTS_ITEMS) return "lesson";
  return "shorts";
}

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

/**
 * The language the *explanation* is in. Japanese terms inside a scene are always spoken by a
 * native ja-JP voice regardless of this, via per-segment `lang`.
 *
 * `hinglish` is romanised Hindi-English read by an Indian English voice — the register this
 * audience actually speaks, and the same convention the social engine uses (SOCIAL_LANGS in
 * src/lib/social/platforms.ts). Devanagari is `hi`; Latin script is `hinglish`. Keeping them
 * separate matters because they need different voices and pace differently: measured 14.29 c/s
 * against 15.45.
 */
export type NarrationLang = "en" | "hi" | "hinglish" | "ja";

export const NARRATION_LANGS: NarrationLang[] = ["en", "hi", "hinglish", "ja"];

export const NARRATION_LANG_LABELS: Record<NarrationLang, string> = {
  en: "English narration",
  hi: "Hindi narration (Devanagari)",
  hinglish: "Hinglish narration (romanised)",
  ja: "Japanese immersion (subtitled)",
};

/**
 * A valid BCP-47 tag for public output.
 *
 * `hinglish` is not a language tag. It reaches the page as `<track srcLang>` and as schema.org
 * `inLanguage`, where an invalid value is an SEO-visible error, so it is mapped to `hi-Latn` —
 * Hindi language, Latin script, which is exactly what it is.
 */
export function publicLanguageTag(lang: NarrationLang | string): string {
  return lang === "hinglish" ? "hi-Latn" : lang;
}

/** One word and the second it is spoken at, relative to the start of its own clip. */
export interface WordTiming {
  text: string;
  start: number;
}

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
  /**
   * Silence AFTER this segment. On a Japanese segment this is the learner's turn to say it back —
   * shadowing — which is the one way to lengthen a teaching video that adds value rather than
   * dead air. Accounted for by sceneNarrationSeconds/segmentOffsets in ./timeline.ts.
   */
  pauseAfterSeconds?: number;
  /** Built by the TTS layer from text/spokenAs — never authored by the LLM or a human. */
  ssml?: string;
  /** Filled in by the worker's `tts` stage. Absent until then. */
  audio?: {
    url: string;
    durationSeconds: number;
    ttsAssetId: string;
    /**
     * When each word starts, for word-by-word captions.
     *
     * Measured, not guessed: Google returns these for SSML `<mark>` timepoints on the voices that
     * accept SSML at all. Chirp3-HD rejects markup, so those clips have no timings and the caption
     * layer estimates instead — see `estimateWordTimings` in ./captions.ts.
     */
    words?: WordTiming[];
  };
}

/**
 * How long things take, and how often they repeat.
 *
 * Replaces the single `targetDurationSeconds` number, which was advisory prose in the LLM prompt
 * while the per-slot word limits were hardcoded — so nothing enforced it. Every field here feeds
 * a computation in src/lib/video/pacing.ts.
 */
export interface PacingConfig {
  /** The one number that matters. Drives the model's per-slot word budget. */
  secondsPerItem: number;
  /** How many times a Japanese term is spoken. Two is right for single words, one for sentences. */
  repeatJapanese: 1 | 2 | 3;
  /** Silence after each Japanese phrase so the learner can repeat it. */
  pauseAfterJapaneseSeconds: number;
  /** Breathing room at the end of every scene, so a cut never clips the last syllable. */
  scenePaddingSeconds: number;
  /** 0.85 by default — slow enough to catch each mora without sounding artificial. */
  japaneseRate: number;
  /** 1.0 by default — the explanation should not drag. */
  narrationRate: number;
  /**
   * How many example sentences each item gets, where the content has them.
   *
   * A ceiling, not a target — most items simply do not have three. Measured across the library:
   * grammar averages 4.4 examples and 67% have two or more, but only 12% of vocabulary and 16% of
   * kanji do. So raising this changes a grammar video substantially and most vocabulary videos not
   * at all, and the UI has to say so rather than offering a knob that silently does nothing.
   */
  examplesPerItem?: number;
}

/** Per-language Google TTS voice names. */
export type VoiceConfig = Partial<Record<NarrationLang, string>>;

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export type SceneType =
  | "mascot_intro"
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

/**
 * Scenes the storyboard builder adds around the content — the mascot beat, the title, the outro,
 * the b-roll shot. Lives here rather than in storyboard.ts because both the highlight builder and
 * the editor need it, and storyboard.ts reaches src/lib/db (and therefore `pg` and `fs`) through
 * load-prompts, which cannot be in a client bundle.
 */
export const CHROME_SCENE_IDS: ReadonlySet<string> = new Set(["sc-mascot", "sc-intro", "sc-outro", "sc-broll"]);

export const SCENE_TYPES: SceneType[] = [
  "mascot_intro", "title_card", "vocab_card", "vocab_list", "kanji_stroke", "kanji_detail", "kana_grid",
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
  /**
   * Seconds a scene must stay on screen even when its narration is shorter.
   *
   * Distinct from `durationSeconds`, which `auto` mode ignores outright — a scene whose visuals
   * take longer to read than to say needs a floor, not a hint. The outro is the motivating case:
   * a logo, headline, URL pill, follow line and icon row cannot be taken in during the two
   * seconds it takes to say "learn more at the site".
   *
   * Honoured by both `resolveSceneDuration()` and `estimateStoryboardDuration()`, so the forecast
   * and the render agree.
   */
  minDurationSeconds?: number;
  transitionIn: Transition;
  /**
   * A sticker from the reusable asset library, chosen at generation and frozen here.
   *
   * Frozen rather than looked up at render for the same reason as branding: the Remotion bundle is
   * a browser build with no database, and a re-render must reproduce what was approved rather than
   * whatever the library holds today. Absent on every lesson-preset scene by design.
   */
  decor?: { slug: string; url: string; corner: "left" | "right" };
  narration: NarrationSegment[];
  visual: VisualSpec;
  /** Overrides project pacing for this scene alone — one hard word may deserve three repeats
   * when the easy ones do not. Unset fields inherit the project config. */
  pacingOverride?: Partial<Pick<PacingConfig, "repeatJapanese" | "pauseAfterJapaneseSeconds" | "scenePaddingSeconds">>;
  /** Admin-only. Never rendered, never spoken. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Visual specs — discriminated on `sceneType`
// ---------------------------------------------------------------------------

/**
 * The opening beat: a mascot waves, says hello, and the topic drops in.
 *
 * Its own scene type rather than a flag on the title card, because it is a different shape —
 * the character is the subject and the text is secondary, which is the reverse of a title card.
 */
export interface MascotIntroVisual {
  sceneType: "mascot_intro";
  /** A MascotId from src/lib/video/mascots.ts. */
  mascot: string;
  /** Spoken and shown, e.g. こんにちは. */
  greeting: string;
  greetingRomaji?: string;
  /** The topic, which lands after the greeting. */
  topic: string;
  eyebrow?: string;
}

export interface TitleCardVisual {
  sceneType: "title_card";
  title: string;
  subtitle?: string;
  /** Optional character alongside the title. A MascotId from ./mascots.ts. */
  mascot?: string;
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
  /**
   * How much of the card is on screen, so one word can be split across beats.
   *
   * `word` shows the Japanese and its reading and withholds the meaning; `all` (the default, and
   * what every existing storyboard means) shows everything. The withheld beat is not only pacing —
   * a viewer who guesses before the answer lands remembers it better than one who reads both at
   * once.
   */
  reveal?: "word" | "all";
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
  /** "@japanesewithavnish", above the icon row. */
  handle?: string;
  /**
   * Platforms shown as icons on the follow row.
   *
   * Stored on the scene rather than read from `@/lib/brand` at render time so that an old
   * storyboard re-rendered a year from now still shows the icons it was authored with — the same
   * reason `content_snapshot` exists.
   */
  socials?: SocialPlatform[];
  /** Waving character above the follow row. A MascotId from ./mascots.ts. */
  mascot?: string;
}

export type VisualSpec =
  | MascotIntroVisual
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

/**
 * Burned-in caption appearance.
 *
 * Everything past `style` was hardcoded until it wasn't: captions rendered at
 * `scale.caption * 1.05` — 42px in a 1080x1920 frame — across 94% of the width, which on a
 * vocabulary scene covered the example sentence the narrator was reading out.
 *
 * Read at RENDER time from `video_projects.captions`, not from the frozen storyboard copy, so
 * changing the size is a re-cut rather than a regenerate. TTS is cached by content hash, so that
 * costs render minutes and no LLM or TTS spend.
 */
export interface CaptionSettings {
  enabled: boolean;
  /** Burned into the frame (required for Shorts/Reels) vs. shipped as a sidecar .srt/.vtt. */
  burnIn: boolean;
  style: "bold-center" | "lower-third";
  /** Multiplier on the per-layout base size. 1.0 was the old hardcoded look. */
  scale?: number;
  /** `bottom` sits above the hashtag pill; `top` clears a lower-third graphic. */
  position?: "bottom" | "lower-third" | "top";
  /** Background pill opacity, 0-1. 0 renders text with its shadow and no plate. */
  opacity?: number;
  /** Percentage of frame width the pill may occupy. */
  maxWidthPct?: number;
  /**
   * `line` shows the whole cue at once, which is what every video did before this field existed.
   * `word` additionally highlights the word being spoken — the karaoke effect a Short is expected
   * to have, and the reason a muted viewer keeps watching.
   */
  mode?: "line" | "word";
}

/**
 * The look every project gets unless it says otherwise.
 *
 * `scale: 0.8` rather than 1.0 deliberately: the reported complaint was that subtitles cover the
 * content, so the default has to change too — a fix that only helps people who find the new
 * picker is not a fix.
 */
export const DEFAULT_CAPTIONS: Required<CaptionSettings> = {
  enabled: true,
  burnIn: true,
  style: "bold-center",
  scale: 0.8,
  position: "bottom",
  opacity: 0.82,
  maxWidthPct: 86,
  mode: "line",
};

/** Fills in fields absent from storyboards written before caption styling existed. Mirrors
 * `resolveBranding()` — same reason, same shape. */
export function resolveCaptions(captions?: Partial<CaptionSettings> | null): Required<CaptionSettings> {
  return { ...DEFAULT_CAPTIONS, ...(captions ?? {}) };
}

export interface BgmSettings {
  trackId: string;
  gainDb: number;
  /** How far the music drops while narration plays. Applied via ffmpeg sidechaincompress. */
  duckDb: number;
  /**
   * Measured tempo, frozen from `video_bgm_tracks` at generation time so the timeline can land
   * cuts on the beat. Absent for free-tempo material and for anything measured at low confidence,
   * and absent means no quantisation rather than a guessed grid.
   */
  bpm?: number;
  /** Seconds from the start of the track to its first beat, so the grid is phase-aligned. */
  beatOffsetSeconds?: number;
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
  cues: { start: number; end: number; text: string; lang: NarrationLang; words?: WordTiming[] }[];
  resolvedAt: string;
}

/**
 * On-screen brand marks, applied across every scene rather than authored into any one of them.
 *
 * Stored on the storyboard so it is part of the document that gets versioned, diffed and
 * re-rendered — a video re-rendered later shows the branding it was approved with, not whatever
 * the constants say today.
 */
export interface BrandingSettings {
  /**
   * `badge`  the full circular logo (public/logo.png)
   * `symbol` the ring and lettering stripped off (public/logo-dark.png)
   * `none`   no watermark
   */
  logo: "badge" | "symbol" | "none";
  /** 0-1. Low enough to sit behind content, high enough to survive a re-upload. */
  logoOpacity: number;
  /** Burned into the frame. Omit to suppress; suppressed on landscape regardless. */
  hashtag?: string;
  /** "@japanesewithavnish", shown on the outro. */
  handle?: string;
  /** Icon row on the outro, in order. */
  socials?: SocialPlatform[];
  /** Waving character on the outro. A MascotId from ./mascots.ts. */
  mascot?: string;
  /** Character art on the intro beat, the bookends and teaching-scene corners. */
  mascots: boolean;
  /**
   * Small persistent title at top centre, on vertical and square only.
   *
   * A viewer arriving mid-scroll on a Reel has no title anywhere on screen — the opening card is
   * long gone. Landscape is excluded because YouTube already shows the title above the player.
   */
  titleBar: boolean;
}

export interface Storyboard {
  schemaVersion: 1;
  projectId: string;
  title: string;
  narrationLang: NarrationLang;
  themeKey: string;
  bgm?: BgmSettings;
  captions: CaptionSettings;
  /** Optional so storyboards written before the Shorts preset existed still parse; absent means
   * `lesson`, which is exactly how they were rendered. */
  stylePreset?: VideoStylePreset;
  /**
   * Which motion profile renders this document. Absent falls back to the style preset's own name,
   * so every storyboard made before profiles existed keeps its exact motion — `lesson` returns an
   * identity camera, and the back catalogue is not restyled by a format opting into movement.
   */
  motionProfile?: "lesson" | "teaching" | "shorts";
  /** Optional so every storyboard authored before branding existed still parses. Consumers
   * resolve it through `resolveBranding()`, which fills in the defaults. */
  branding?: BrandingSettings;
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
  | "content_item"
  /** A theme like "birds in Japanese" — no curriculum node, no single content_type. Resolves
   * through `postIds`, which the topic builder fills in after you confirm the item list. */
  | "topic"
  /**
   * One kana row (the a-line, the ka-line) or a whole syllabary.
   *
   * Its own scope kind because the `kana` table has NO `post_id` and every other scope resolves
   * through posts — so kana was completely unreachable despite all 92 characters having stroke
   * data and `kana_grid` being a finished component. Creating 92 posts to route around that would
   * have added 92 thin pages, which is the pattern that hurt the reading section.
   */
  | "kana_set";

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
  /** `topic` scope only: the free text the video is about, used for the title and the prompt. */
  topic?: string;
  /** `kana_set` scope only. */
  kanaType?: "hiragana" | "katakana";
  /** A single row like "a" or "ka". Omitted covers the whole syllabary. */
  kanaRow?: string;
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
  /**
   * Content this item explicitly teaches, for a `lesson` item.
   *
   * Populated from the curriculum's own join tables (`curriculum_lesson_vocabulary`,
   * `_kanji`, `_grammar`) — so these are the words and patterns the lesson declares, not a
   * topic guess. Without them a lesson video is only its section headings: lessons themselves
   * carry nothing but `section_heading` and `rich_text` blocks.
   */
  children?: ContentItem[];
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
  pacing: PacingConfig | null;
  voices: VoiceConfig | null;
  /** Siblings of one video_per_item split share this. NULL for a standalone project. */
  batchId: string | null;
  /** Which pacing and motion rules this project generates and renders under. */
  stylePreset: VideoStylePreset;
  /** The format template it was created from, so a regenerate reproduces the same format. */
  templateId: string | null;
  /** Caption style. Read at render time, so changing it is a re-cut rather than a regenerate. */
  captions: Partial<CaptionSettings> | null;
  /** Per-project brand overrides. NULL = DEFAULT_BRANDING. */
  branding: Partial<BrandingSettings> | null;
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
