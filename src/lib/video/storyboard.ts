/**
 * Video Studio — builds a storyboard from resolved content.
 *
 * Division of labour, and the reason this file is structured the way it is:
 *
 *   Everything ON SCREEN is built deterministically from the database.
 *   Only the SPOKEN EXPLANATION is written by the LLM.
 *
 * A hallucinated blog paragraph is embarrassing; a hallucinated kanji reading burned into a
 * teaching video is actively harmful, and it ships to YouTube where it cannot be quietly
 * edited. So the skeleton builder fills every visual field and every Japanese narration
 * segment straight from `vocabulary.reading` / `kanji.onyomi` / `examples.sentence_ja`, and the
 * model is handed a list of blank segment ids to fill in with English/Hindi prose. It never
 * sees a slot where it could invent Japanese.
 *
 * Word budgets are COMPUTED from the project's PacingConfig via ./pacing.ts, not hardcoded.
 * They used to be constants while a separate "target duration" was passed to the model as
 * advisory prose, which meant nothing connected the request to the result — 60 seconds asked
 * for, 121 and ~400 delivered.
 */
import { randomUUID } from "crypto";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { BRAND } from "../brand";
import { MASCOT_INTRO_SECONDS, OUTRO_MIN_SECONDS, resolveBranding } from "./branding";
import { MASCOT_GREETING, isGenerated, type MascotId } from "./mascots";
import {
  defaultPacingFor,
  distributeSlotBudget,
  estimateStoryboardDuration,
  narrationSecondsForItem,
  resolvePacing,
  secondsForWords,
} from "./pacing";
import type {
  BrandingSettings,
  ContentItem,
  ContentSnapshot,
  ExampleSentence,
  NarrationLang,
  NarrationSegment,
  PacingConfig,
  Scene,
  Storyboard,
  VocabItem,
  VoiceConfig,
} from "./types";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const CHAT_MODEL = "deepseek-chat";

/** DeepSeek deepseek-chat cache-miss pricing, matching the constants in
 * src/lib/contentReview/jobRunner.ts. Estimates for reporting, not billing truth. */
const PROMPT_COST_PER_TOKEN = 0.14 / 1_000_000;
const COMPLETION_COST_PER_TOKEN = 0.28 / 1_000_000;

export interface GenerateStoryboardConfig {
  projectId: string;
  narrationLang: NarrationLang;
  themeKey: string;
  pacing: PacingConfig;
  voices?: VoiceConfig | null;
  tone?: string | null;
  bgm?: { trackId: string; gainDb: number; duckDb: number };
  burnInCaptions?: boolean;
  siteName?: string;
  siteUrl?: string;
  /** Overrides on top of DEFAULT_BRANDING. Unset fields inherit. */
  branding?: Partial<BrandingSettings> | null;
  /**
   * Insert a real-page B-roll beat before the outro, showing the live page the content came
   * from. Off by default: capture costs a browser launch per video, and a 60-second vocabulary
   * short usually has no room for it.
   */
  includeBroll?: boolean;
}

export interface GeneratedStoryboard {
  storyboard: Storyboard;
  usage: { promptTokens: number; completionTokens: number };
  estimatedCostUsd: number;
  model: string;
  promptKey: string;
  /** Everything that was sent, for the audit row. */
  request: GenerationRequest;
  rawResponse: string;
  durationMs: number;
  /** DeepSeek requests made. >1 means the scope was chunked. */
  callCount: number;
  /** Slot ids still empty after a retry — a short video with a reason attached. */
  missingSlots: string[];
}

// ---------------------------------------------------------------------------
// Japanese extraction — the mixed-pattern fix
// ---------------------------------------------------------------------------

/** Hiragana, katakana, CJK ideographs, the iteration marks, and the long-vowel bar. */
const JAPANESE_RUN = /[ぁ-ゟ゠-ヿ一-鿿々〆ー々〆ヶ]+/g;

/**
 * Keeps only the Japanese runs of a mixed string.
 *
 * 280 of 548 published grammar patterns look like `Verb volitional form + と思います`. That is the
 * correct way to WRITE a grammar point and the screen keeps it verbatim — but handed to a ja-JP
 * voice it is read with Japanese phonetics and comes out as gibberish, which would have made
 * half of every grammar video unusable.
 */
export function japaneseOnly(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const runs = text.match(JAPANESE_RUN);
  if (!runs) return undefined;
  // Runs separated by removed Latin text are joined by a short pause rather than jammed
  // together, so 「Vて-form + ください」 does not become one run-on word.
  const joined = runs.map((r) => r.trim()).filter(Boolean).join("、");
  return joined || undefined;
}

/**
 * What the voice should say for a grammar pattern.
 *
 * Prefers the curated `pattern_spoken` column (backfilled by scripts/backfill-grammar-spoken.ts),
 * falls back to extracting the Japanese, and returns undefined when nothing survives — in which
 * case the caller emits no Japanese segment at all and the English narrator carries the point.
 * Degrading to English-only is correct; degrading to mispronounced Japanese is not.
 */
export function spokenGrammarPattern(data: Record<string, unknown>, pattern: string): string | undefined {
  const curated = typeof data.pattern_spoken === "string" ? data.pattern_spoken.trim() : "";
  if (curated) return curated;
  return japaneseOnly(pattern);
}

// ---------------------------------------------------------------------------
// Reading normalisation
// ---------------------------------------------------------------------------

/**
 * Some `reading` values list alternatives — 良い is stored as "いい / よい", and a few use 、 or a
 * comma. On screen that is useful information, but handed to a voice it is read aloud verbatim
 * as "ii slash yoi". Only the first reading is spoken; the display keeps whatever the DB holds.
 */
export function primaryReading(reading?: string | null): string | undefined {
  if (!reading) return undefined;
  const first = reading.split(/[/／、,]/)[0].trim();
  return first || undefined;
}

/** Strips kanji-dictionary notation from on/kun readings so they can be spoken: `す.き` is the
 * word すき with the okurigana boundary marked, and `-がわ` marks a suffix reading. */
export function speakableReadings(readings: string[]): string | undefined {
  const cleaned = readings
    .map((r) => r.replace(/[.．]/g, "").replace(/^[-−–—]+|[-−–—]+$/g, "").trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned.join("、") : undefined;
}

// ---------------------------------------------------------------------------
// Segment builders
// ---------------------------------------------------------------------------

interface BlankSlot {
  id: string;
  hint: string;
  maxWords: number;
  /** Relative share of the item's narration budget. The slot carrying the real explanation
   * deserves more than one saying "here's an example". */
  weight?: number;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toVocabItem(item: ContentItem): VocabItem {
  const d = item.data;
  return {
    word: str(d.word) ?? item.title,
    reading: str(d.reading),
    romaji: str(d.romaji),
    meaning: str(d.meaning) ?? item.summary ?? "",
    partOfSpeech: str(d.part_of_speech),
    transitivity: str(d.transitivity),
    example: item.examples[0],
  };
}

/**
 * One Japanese narration segment.
 *
 * `pause` is opt-in rather than automatic. A shadowing pause belongs after something the learner
 * should say back — a word, a sentence, a pattern. After a list of on'yomi readings it is just
 * dead air, and applying it everywhere made a kanji video 91 seconds of silence out of 172.
 */
function jaSegment(
  id: string,
  text: string,
  reading: string | undefined,
  pacing: PacingConfig,
  leadIn = 0.15,
  pause = true
): NarrationSegment {
  return {
    id,
    text,
    lang: "ja",
    spokenAs: primaryReading(reading),
    leadInSeconds: leadIn,
    pauseAfterSeconds: pause ? pacing.pauseAfterJapaneseSeconds : undefined,
    speakingRate: pacing.japaneseRate,
  };
}

/**
 * Pushes a Japanese phrase `repeatJapanese` times.
 *
 * Repetition plus the pause between is what shadowing is: hear it, say it, hear it again. It is
 * the only honest way to make a teaching video longer, as opposed to padding it.
 */
function pushJapanese(
  narration: NarrationSegment[],
  baseId: string,
  text: string,
  reading: string | undefined,
  pacing: PacingConfig,
  firstLeadIn = 0.25
): void {
  for (let i = 0; i < pacing.repeatJapanese; i++) {
    const isLast = i === pacing.repeatJapanese - 1;
    narration.push(jaSegment(`${baseId}-${i + 1}`, text, reading, pacing, i === 0 ? firstLeadIn : 0.1, isLast));
  }
}

function blankSegment(id: string, lang: NarrationLang, pacing: PacingConfig, leadIn = 0): NarrationSegment {
  return {
    id,
    text: "",
    lang,
    leadInSeconds: leadIn || undefined,
    speakingRate: pacing.narrationRate,
  };
}

function exampleSpoken(example: ExampleSentence): string | undefined {
  return example.readingKana;
}

interface Skeleton {
  scenes: Scene[];
  blanks: BlankSlot[];
}

/** Turns an item's raw slots into budgeted ones using the pacing config. */
function budgetItemSlots(
  slots: { id: string; hint: string; weight?: number }[],
  japaneseText: string[],
  config: GenerateStoryboardConfig
): BlankSlot[] {
  const seconds = narrationSecondsForItem({
    pacing: config.pacing,
    japaneseText,
    slotCount: slots.length,
  });
  return distributeSlotBudget(slots, seconds, config.narrationLang, config.pacing.narrationRate);
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function vocabularySkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];
  const items = snapshot.items.map(toVocabItem);
  const level = snapshot.jlptLevel ? `${snapshot.jlptLevel} ` : "";

  items.forEach((item, i) => {
    const base = `sc-w${i + 1}`;
    const narration: NarrationSegment[] = [];
    const slots: { id: string; hint: string; weight?: number }[] = [];
    const japanese: string[] = [item.word];

    const leadId = `${base}-lead`;
    narration.push(blankSegment(leadId, lang, pacing));
    slots.push({
      id: leadId,
      hint: `Introduce word ${i + 1} of ${items.length}: "${item.word}" (reading: ${item.reading ?? "n/a"}) meaning "${item.meaning}". Say the meaning naturally. Do NOT attempt to pronounce the Japanese — a native voice speaks it right after you.`,
      weight: 2,
    });

    pushJapanese(narration, `${base}-ja`, item.word, item.reading, pacing);

    if (item.example) {
      japanese.push(item.example.ja);
      const exId = `${base}-exlead`;
      narration.push(blankSegment(exId, lang, pacing, 0.3));
      slots.push({
        id: exId,
        hint: `Introduce an example sentence for "${item.word}". Its English meaning is "${item.example.en}". One short lead-in clause only.`,
        weight: 1,
      });
      narration.push(jaSegment(`${base}-exja`, item.example.ja, exampleSpoken(item.example), pacing, 0.25));
    }

    blanks.push(...budgetItemSlots(slots, japanese, config));

    scenes.push({
      id: base,
      sceneType: "vocab_card",
      sourceRef: snapshot.items[i].postId
        ? { kind: "post", id: snapshot.items[i].postId!, url: snapshot.items[i].url }
        : undefined,
      durationMode: "auto",
      durationSeconds: pacing.secondsPerItem,
      transitionIn: { kind: "slide", durationSeconds: 0.3 },
      narration,
      visual: {
        sceneType: "vocab_card",
        item,
        index: i + 1,
        total: items.length,
        showFurigana: Boolean(item.reading && item.reading !== item.word),
      },
    });
  });

  if (items.length > 1) {
    const recapId = "sc-recap-nar";
    scenes.push({
      id: "sc-recap",
      sceneType: "summary_recap",
      durationMode: "auto",
      durationSeconds: 4,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(recapId, lang, pacing)],
      visual: {
        sceneType: "summary_recap",
        heading: "Quick recap",
        points: items.map((i) => `${i.word}${i.reading && i.reading !== i.word ? ` (${i.reading})` : ""} — ${i.meaning}`),
      },
    });
    blanks.push({
      id: recapId,
      hint: "One sentence telling the viewer to test themselves on the words now shown on screen.",
      maxWords: 18,
    });
  }

  return withIntroOutro(scenes, blanks, snapshot, config, `${items.length} ${level}words`);
}

function kanjiSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const d = item.data;
    const character = str(d.character) ?? item.title;
    const meaning = str(d.meaning) ?? item.summary ?? "";
    const onyomi = strArray(d.onyomi);
    const kunyomi = strArray(d.kunyomi);
    const strokeRaw = d.stroke_data as { paths?: unknown } | unknown[] | null | undefined;
    const strokePaths = Array.isArray(strokeRaw)
      ? strArray(strokeRaw)
      : strArray((strokeRaw as { paths?: unknown } | null)?.paths);
    const exampleWords = Array.isArray(d.exampleWords) ? (d.exampleWords as VocabItem[]) : [];

    const base = `sc-k${i + 1}`;
    const narration: NarrationSegment[] = [];
    const slots: { id: string; hint: string; weight?: number }[] = [];
    const japanese: string[] = [];

    const leadId = `${base}-lead`;
    narration.push(blankSegment(leadId, lang, pacing));
    slots.push({
      id: leadId,
      hint: `Introduce the kanji ${character}, which means "${meaning}". Mention it has ${d.stroke_count ?? "several"} strokes.`,
      weight: 2,
    });

    // On/kun are stored in dictionary notation — す.き marks where the okurigana starts, and a
    // leading/trailing hyphen marks a prefix/suffix reading. Those marks belong on screen (the
    // scene renders the raw arrays) but a voice reads them aloud as "su dot ki", so speech gets
    // a cleaned copy via spokenAs.
    if (onyomi.length) {
      const spoken = speakableReadings(onyomi);
      narration.push(jaSegment(`${base}-on`, onyomi.join("、"), spoken, pacing, 0.3, false));
      if (spoken) japanese.push(spoken);
    }
    if (kunyomi.length) {
      const spoken = speakableReadings(kunyomi);
      narration.push(jaSegment(`${base}-kun`, kunyomi.join("、"), spoken, pacing, 0.3, false));
      if (spoken) japanese.push(spoken);
    }

    // Words that actually use the character. For most kanji this is the only concrete usage the
    // video can show, since only ~5% have example sentences of their own.
    if (exampleWords.length > 0) {
      const wordsLeadId = `${base}-words`;
      narration.push(blankSegment(wordsLeadId, lang, pacing, 0.3));
      slots.push({
        id: wordsLeadId,
        hint: `Introduce real words that use ${character}: ${exampleWords.map((w) => `${w.word} (${w.meaning})`).join(", ")}. Give the meanings; a native voice says the words.`,
        weight: 1.5,
      });
      exampleWords.forEach((word, wi) => {
        narration.push(jaSegment(`${base}-w${wi}`, word.word, word.reading, pacing, 0.25));
        japanese.push(word.word);
      });
    }

    scenes.push({
      id: base,
      sceneType: "kanji_stroke",
      sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
      durationMode: "auto",
      durationSeconds: pacing.secondsPerItem,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration,
      visual: {
        sceneType: "kanji_stroke",
        character,
        meaning,
        meaningExtended: str(d.meaning_extended),
        onyomi,
        kunyomi,
        strokeCount: typeof d.stroke_count === "number" ? d.stroke_count : undefined,
        strokePaths,
        exampleWords,
      },
    });

    item.examples.slice(0, 2).forEach((example, ei) => {
      const exBase = `${base}-ex${ei + 1}`;
      const exLeadId = `${exBase}-lead`;
      scenes.push({
        id: exBase,
        sceneType: "example_sentence",
        durationMode: "auto",
        durationSeconds: Math.max(4, pacing.secondsPerItem * 0.5),
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [
          blankSegment(exLeadId, lang, pacing),
          jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), pacing, 0.25),
        ],
        visual: { sceneType: "example_sentence", sentences: [example], highlight: [character] },
      });
      slots.push({ id: exLeadId, hint: `Lead into an example using ${character}. The sentence means "${example.en}".`, weight: 1 });
      japanese.push(example.ja);
    });

    // One budget for the whole item, examples included — see the note in grammarSkeleton.
    blanks.push(...budgetItemSlots(slots, japanese, config));
  });

  return withIntroOutro(scenes, blanks, snapshot, config, `${snapshot.items.length} kanji`);
}

function grammarSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const d = item.data;
    const pattern = str(d.pattern) ?? item.title;
    const meaning = str(d.meaning) ?? item.summary ?? "";
    const base = `sc-g${i + 1}`;

    // THE mixed-pattern fix. `pattern` is often "Verb volitional form + と思います"; only the
    // Japanese part may reach the Japanese voice, and if there is none we say nothing in
    // Japanese rather than saying it wrong.
    const spokenPattern = spokenGrammarPattern(d, pattern);

    const narration: NarrationSegment[] = [];
    const slots: { id: string; hint: string; weight?: number }[] = [];
    const japanese: string[] = [];

    const leadId = `${base}-lead`;
    const useId = `${base}-use`;

    narration.push(blankSegment(leadId, lang, pacing));
    slots.push({
      id: leadId,
      hint: `Introduce the grammar pattern "${pattern}", which means "${meaning}". You MUST say the pattern's English scaffolding yourself (for example "verb volitional form plus") because the Japanese voice only speaks the Japanese part.`,
      weight: 2,
    });

    if (spokenPattern) {
      pushJapanese(narration, `${base}-ja`, pattern, spokenPattern, pacing);
      japanese.push(spokenPattern);
    }

    narration.push(blankSegment(useId, lang, pacing, 0.3));
    slots.push({
      id: useId,
      hint: `Explain when to use "${pattern}".${str(d.when_to_use) ? ` Source note: ${str(d.when_to_use)}` : ""}`,
      weight: 3,
    });

    scenes.push({
      id: base,
      sceneType: "grammar_pattern",
      sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
      durationMode: "auto",
      durationSeconds: pacing.secondsPerItem,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration,
      visual: {
        sceneType: "grammar_pattern",
        pattern,
        reading: str(d.pattern_romaji),
        meaning,
        structure: str(d.structure),
        level: str(d.level) ?? item.jlptLevel,
        whenToUse: str(d.when_to_use),
      },
    });

    item.examples.slice(0, 3).forEach((example, ei) => {
      const exBase = `${base}-ex${ei + 1}`;
      const exLeadId = `${exBase}-lead`;
      scenes.push({
        id: exBase,
        sceneType: "example_sentence",
        durationMode: "auto",
        durationSeconds: Math.max(4, pacing.secondsPerItem * 0.4),
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [
          blankSegment(exLeadId, lang, pacing),
          jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), pacing, 0.25),
        ],
        // Highlight only the Japanese part — "Verb volitional form" never appears in a sentence.
        visual: { sceneType: "example_sentence", sentences: [example], highlight: spokenPattern ? [spokenPattern] : [] },
      });
      slots.push({ id: exLeadId, hint: `Lead into example ${ei + 1} for "${pattern}". It means "${example.en}".`, weight: 1 });
      japanese.push(example.ja);
    });

    // ONE budget for the whole item — main scene and every example together. Budgeting each
    // example separately gave a 10-item grammar video four times the narration it asked for.
    blanks.push(...budgetItemSlots(slots, japanese, config));
  });

  return withIntroOutro(scenes, blanks, snapshot, config, snapshot.title);
}

/** Generic fallback: narrate an item's title + summary. Used for reading/listening/writing/
 * sounds/conversation/study_guide and for curriculum lessons. */
function genericSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const base = `sc-i${i + 1}`;
    const leadId = `${base}-lead`;
    scenes.push({
      id: base,
      sceneType: "title_card",
      sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
      durationMode: "auto",
      durationSeconds: pacing.secondsPerItem,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(leadId, lang, pacing)],
      visual: {
        sceneType: "title_card",
        eyebrow: item.jlptLevel ? `JLPT ${item.jlptLevel}` : undefined,
        title: item.title,
        subtitle: item.summary?.slice(0, 120),
      },
    });
    blanks.push(
      ...budgetItemSlots(
        [
          {
            id: leadId,
            hint: `Explain "${item.title}". ${item.summary ? `Summary: ${item.summary.slice(0, 400)}` : ""}`,
          },
        ],
        [],
        config
      )
    );

    item.examples.slice(0, 2).forEach((example, ei) => {
      const exBase = `${base}-ex${ei + 1}`;
      scenes.push({
        id: exBase,
        sceneType: "example_sentence",
        durationMode: "auto",
        durationSeconds: Math.max(4, pacing.secondsPerItem * 0.35),
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), pacing, 0.2)],
        visual: { sceneType: "example_sentence", sentences: [example] },
      });
    });
  });

  return withIntroOutro(scenes, blanks, snapshot, config, snapshot.title);
}

function withIntroOutro(
  scenes: Scene[],
  blanks: BlankSlot[],
  snapshot: ContentSnapshot,
  config: GenerateStoryboardConfig,
  titleText: string
): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const introId = "sc-intro-nar";
  const outroId = "sc-outro-nar";
  const brollUrl = snapshot.items[0]?.url;
  const brollScenes: Scene[] = [];
  const brollBlanks: BlankSlot[] = [];

  if (config.includeBroll && brollUrl) {
    const brollId = "sc-broll-nar";
    brollScenes.push({
      id: "sc-broll",
      sceneType: "broll_page",
      sourceRef: snapshot.items[0].postId ? { kind: "post", id: snapshot.items[0].postId!, url: brollUrl } : undefined,
      durationMode: "auto",
      durationSeconds: 5,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(brollId, lang, pacing)],
      visual: {
        sceneType: "broll_page",
        sourceUrl: brollUrl,
        captureKind: "scroll_clip",
        caption: "See the full breakdown on the site",
      },
    });
    brollBlanks.push({
      id: brollId,
      hint: "One sentence pointing the viewer at the full page on the site for this content.",
      maxWords: 20,
    });
  }

  const branding = resolveBranding(config.branding);

  // The mascot beat, when branding asks for it. Fixed duration and NO narration slot: its whole
  // job is the first second of a Reel, and adding a spoken line would both lengthen it and
  // compete with the greeting already on screen.
  const mascotIntro: Scene[] = branding.mascots
    ? [
        {
          id: "sc-mascot",
          sceneType: "mascot_intro",
          durationMode: "fixed",
          durationSeconds: MASCOT_INTRO_SECONDS,
          transitionIn: { kind: "fade", durationSeconds: 0.3 },
          narration: [],
          visual: {
            sceneType: "mascot_intro",
            // branding.mascot is the project's lead character. It has existed on the type since
            // branding landed and nothing ever read it — both bookends were hardcoded to the fox,
            // so the Brand Check panel's character picker had no effect on any render.
            mascot: leadMascotFor(branding, "wave"),
            greeting: MASCOT_GREETING[lang]?.ja ?? "こんにちは",
            greetingRomaji: MASCOT_GREETING[lang]?.romaji,
            topic: titleText,
            eyebrow: snapshot.jlptLevel ? `JLPT ${snapshot.jlptLevel}` : undefined,
          },
        },
      ]
    : [];

  const intro: Scene = {
    id: "sc-intro",
    sceneType: "title_card",
    durationMode: "auto",
    durationSeconds: 3,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(introId, lang, pacing)],
    visual: {
      sceneType: "title_card",
      eyebrow: snapshot.jlptLevel ? `JLPT ${snapshot.jlptLevel}` : undefined,
      title: titleText,
      subtitle: snapshot.title !== titleText ? snapshot.title : undefined,
      jlptLevel: snapshot.jlptLevel,
    },
  };

  const outro: Scene = {
    id: "sc-outro",
    sceneType: "cta_outro",
    durationMode: "auto",
    durationSeconds: OUTRO_MIN_SECONDS,
    // The outro now carries a logo, headline, subline, URL pill, follow line and an icon row.
    // Sized off narration alone it lands around two seconds and the icons flash past unread.
    // `auto` still lets a longer closing line stretch it past the floor.
    minDurationSeconds: OUTRO_MIN_SECONDS,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(outroId, lang, pacing)],
    visual: {
      sceneType: "cta_outro",
      headline: "Learn more at",
      subline: config.siteName ?? BRAND.shortName,
      url: config.siteUrl ?? outroSiteUrl(),
      showLogo: branding.logo !== "none",
      handle: branding.handle,
      socials: branding.socials,
      mascot: branding.mascots ? leadMascotFor(branding, "celebrate") : undefined,
    },
  };

  return {
    scenes: [...mascotIntro, intro, ...scenes, ...brollScenes, outro],
    blanks: [
      { id: introId, hint: `Hook for a video about ${titleText}. Make someone stop scrolling.`, maxWords: 22 },
      ...blanks,
      ...brollBlanks,
      { id: outroId, hint: "A short closing call to action.", maxWords: 16 },
    ],
  };
}

/**
 * Scene ids that `withIntroOutro` adds. Stripped when one skeleton is embedded inside another,
 * so a lesson does not get three intros and three outros.
 */
const CHROME_SCENE_IDS: ReadonlySet<string> = new Set(["sc-mascot", "sc-intro", "sc-outro", "sc-broll"]);
const CHROME_SLOT_IDS: ReadonlySet<string> = new Set(["sc-intro-nar", "sc-outro-nar", "sc-broll-nar"]);

/**
 * Builds the body of a per-kind skeleton, without its intro/outro chrome, and with every id
 * prefixed so two embedded groups cannot collide.
 *
 * Scene ids must be unique across a storyboard: the TTS cache and the timeline editor's
 * selection both key off them, and every per-kind builder numbers its scenes from `sc-i1`.
 * A lesson embedding both vocabulary and kanji would otherwise produce two `sc-i1`.
 */
function embeddedBody(
  snapshot: ContentSnapshot,
  config: GenerateStoryboardConfig,
  prefix: string
): { scenes: Scene[]; blanks: BlankSlot[] } {
  const built = buildSkeleton(snapshot, config);

  const scenes = built.scenes
    .filter((scene) => !CHROME_SCENE_IDS.has(scene.id))
    .map((scene) => ({
      ...scene,
      id: `${prefix}-${scene.id}`,
      narration: scene.narration.map((segment) => ({ ...segment, id: `${prefix}-${segment.id}` })),
    }));

  const blanks = built.blanks
    .filter((slot) => !CHROME_SLOT_IDS.has(slot.id))
    .map((slot) => ({ ...slot, id: `${prefix}-${slot.id}` }));

  return { scenes, blanks };
}

/**
 * A curriculum lesson.
 *
 * Two halves, because a lesson is two things. Its own blocks are only section headings and
 * prose, which become the walkthrough — a title card per heading, narrated from the prose
 * underneath it. Then the vocabulary, kanji and grammar the lesson explicitly declares
 * (`ContentItem.children`, from the curriculum's join tables) get the same real scenes they
 * would get in a batch video: word cards, stroke order, pattern breakdowns.
 *
 * Without the second half a lesson video is a slideshow of headings — which is what the generic
 * skeleton produced, because it ignores `blocks` and lessons carry no `examples`.
 */
function lessonSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const pacing = config.pacing;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const base = `sc-l${i + 1}`;

    // -- the lesson's own walkthrough ---------------------------------------
    // Pair each heading with the prose that follows it; the prose is the source material for
    // that section's narration, never shown on screen (it is markdown, and long).
    const sections: { title: string; prose: string }[] = [];
    for (const block of item.blocks) {
      const data = block.data as Record<string, unknown>;
      if (block.blockType === "section_heading") {
        const title = str(data.title);
        if (title) sections.push({ title, prose: "" });
      } else if (block.blockType === "rich_text" && sections.length > 0) {
        const markdown = str(data.markdown);
        if (markdown) {
          const current = sections[sections.length - 1];
          current.prose = `${current.prose} ${markdown}`.trim();
        }
      }
    }

    sections.forEach((section, si) => {
      const slotId = `${base}-s${si + 1}`;
      scenes.push({
        id: `${base}-sec${si + 1}`,
        sceneType: "title_card",
        sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
        durationMode: "auto",
        durationSeconds: pacing.secondsPerItem,
        transitionIn: { kind: "fade", durationSeconds: 0.4 },
        narration: [blankSegment(slotId, lang, pacing)],
        visual: {
          sceneType: "title_card",
          eyebrow: si === 0 && item.jlptLevel ? `JLPT ${item.jlptLevel}` : undefined,
          title: section.title,
          subtitle: sections.length > 1 ? `${si + 1} of ${sections.length}` : undefined,
        },
      });
      blanks.push({
        id: slotId,
        // The prose is the source, and the model is told to teach from it rather than read it:
        // lesson prose is written to be read on a page, and reads badly aloud verbatim.
        hint:
          `Section "${section.title}" of the lesson "${item.title}". Teach this section in your own ` +
          `words, spoken aloud. Source material: ${section.prose.slice(0, 700) || "(no prose — use the heading)"}`,
        maxWords: 0,
        weight: 1,
      });
    });

    // -- what the lesson actually teaches ------------------------------------
    // Grouped by kind so each group goes through its own real builder.
    const children = item.children ?? [];
    const byKind = new Map<string, ContentItem[]>();
    for (const child of children) {
      byKind.set(child.kind, [...(byKind.get(child.kind) ?? []), child]);
    }

    // Array.from rather than iterating the Map directly: this tsconfig's target predates
    // downlevelIteration, so `for (… of map)` fails the production build.
    for (const [kind, group] of Array.from(byKind)) {
      // Pace each group as its OWN kind, not as the lesson.
      //
      // A lesson is 45s per item; a vocabulary word is 16. Passing the lesson's pacing down gave
      // all 65 embedded words a 45-second budget, which estimated one lesson at 53 minutes while
      // the model — correctly — wrote about 16 seconds' worth per word and produced 20. The
      // budget has to match the thing being budgeted, or the forecast is fiction. Everything
      // else (repeats, pause, rates) stays as the project configured it.
      const childConfig: GenerateStoryboardConfig = {
        ...config,
        pacing: { ...config.pacing, secondsPerItem: defaultPacingFor(kind).secondsPerItem },
      };
      const embedded = embeddedBody(
        { ...snapshot, items: group, title: item.title },
        childConfig,
        `${base}-${kind}`
      );
      scenes.push(...embedded.scenes);
      blanks.push(...embedded.blanks);
    }
  });

  // Slots created above with maxWords 0 get their real budget here, alongside the embedded ones
  // which already have theirs.
  const sectionSlots = blanks.filter((b) => b.maxWords === 0);
  if (sectionSlots.length > 0) {
    const budgeted = budgetItemSlots(
      sectionSlots.map((b) => ({ id: b.id, hint: b.hint })),
      [],
      config
    );
    const budgetById = new Map(budgeted.map((b) => [b.id, b.maxWords]));
    for (const slot of blanks) {
      if (slot.maxWords === 0) slot.maxWords = budgetById.get(slot.id) ?? 40;
    }
  }

  return withIntroOutro(scenes, blanks, snapshot, config, snapshot.title);
}

export function buildSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const kind = snapshot.items[0]?.kind;
  if (kind === "vocabulary") return vocabularySkeleton(snapshot, config);
  if (kind === "kanji") return kanjiSkeleton(snapshot, config);
  if (kind === "grammar") return grammarSkeleton(snapshot, config);
  if (kind === "lesson") return lessonSkeleton(snapshot, config);
  return genericSkeleton(snapshot, config);
}

// ---------------------------------------------------------------------------
// Prompt assembly — separated so the preview endpoint can show it without generating
// ---------------------------------------------------------------------------

export const VIDEO_PROMPT_KEY_BY_KIND: Record<string, string> = {
  vocabulary: "video_narration_vocabulary",
  kanji: "video_narration_kanji",
  grammar: "video_narration_grammar",
  reading: "video_narration_reading",
  listening: "video_narration_listening",
  lesson: "video_narration_lesson",
};

const LANGUAGE_INSTRUCTION: Record<NarrationLang, string> = {
  en: "Write in natural spoken English. Indian-English learners are the core audience, so keep vocabulary plain and avoid US-specific idioms.",
  hi: "Write in natural spoken Hindi using Devanagari script. Keep it conversational, the way a friendly teacher speaks — not formal written Hindi.",
  ja: "Write in simple spoken Japanese suitable for the learner's level, using kana and only common kanji.",
};

/** Built-in fallback so generation works before anyone edits the prompt at /admin/prompts. A
 * DB row with the same key overrides this entirely. */
export function defaultSystemPrompt(lang: NarrationLang, tone?: string | null): string {
  return [
    "You write voiceover narration for short Japanese-language teaching videos.",
    "",
    LANGUAGE_INSTRUCTION[lang],
    "",
    "Hard rules:",
    "- You are writing words that will be SPOKEN ALOUD by a text-to-speech voice. No markdown, no bullet points, no emoji, no parentheses, no stage directions.",
    "- Never write Japanese text in a slot whose language is not Japanese. Every Japanese word and sentence in this video is already spoken by a separate native Japanese voice; if you write Japanese, it will be mispronounced by the wrong voice.",
    "- Never state a reading, pronunciation, romaji, or stroke count. Those are already on screen and already spoken. Stating them from memory risks being wrong.",
    "- Never invent example sentences, meanings, or grammar rules. Use only what the hint gives you.",
    "- Each slot's word count is a TARGET, not a ceiling. Write close to it — within about 10%. The numbers are computed from the video's pacing, so a slot that comes in far under leaves the on-screen card sitting in silence, and one that runs over desynchronises the audio from the visuals.",
    "- Write flowing speech, not headings. One or two sentences per slot.",
    tone ? `\nTone: ${tone}` : "",
    "",
    'Return ONLY a JSON object mapping each slot id to its narration string, e.g. {"sc-intro-nar":"...","sc-w1-lead":"..."}. No markdown fence, no commentary.',
  ]
    .filter(Boolean)
    .join("\n");
}

export interface GenerationRequest {
  systemPrompt: string;
  userMessage: string;
  slots: BlankSlot[];
  promptKey: string;
  model: string;
  maxTokens: number;
  /** What the pacing engine expects this script to run to, before a word is written. */
  estimatedSeconds: number;
  sceneCount: number;
  itemCount: number;
}

export function buildUserMessage(snapshot: ContentSnapshot, config: GenerateStoryboardConfig, slots: BlankSlot[]): string {
  const kind = snapshot.items[0]?.kind ?? "vocabulary";
  return [
    `Video title: ${snapshot.title}`,
    snapshot.jlptLevel ? `JLPT level: ${snapshot.jlptLevel}` : "",
    `Content type: ${kind}`,
    `Pacing: about ${config.pacing.secondsPerItem} seconds per item. The word counts below are derived from that timing — aim for them rather than staying comfortably under.`,
    "",
    "Write narration for each slot below. Return a JSON object keyed by slot id.",
    "",
    ...slots.map((b) => `${b.id} (~${b.maxWords} words): ${b.hint}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Everything that would be sent to the model, without sending it.
 *
 * The prompt preview panel renders this, and `generateStoryboard` consumes the same shape — so
 * what you inspect is exactly what runs.
 */
export async function buildGenerationRequest(
  snapshot: ContentSnapshot,
  config: GenerateStoryboardConfig
): Promise<{ request: GenerationRequest; skeleton: Skeleton }> {
  const skeleton = buildSkeleton(snapshot, config);
  const kind = snapshot.items[0]?.kind ?? "vocabulary";
  const promptKey = VIDEO_PROMPT_KEY_BY_KIND[kind] ?? "video_narration_shared";

  const dbPrompt = await getPromptContent(promptKey);
  const systemPrompt = dbPrompt || defaultSystemPrompt(config.narrationLang, config.tone);
  const userMessage = buildUserMessage(snapshot, config, skeleton.blanks);

  return {
    skeleton,
    request: {
      systemPrompt,
      userMessage,
      slots: skeleton.blanks,
      promptKey,
      model: CHAT_MODEL,
      maxTokens: Math.min(8000, 600 + skeleton.blanks.length * 90),
      estimatedSeconds: estimateStoryboardDuration(
        skeleton.scenes,
        config.pacing,
        new Map(
          skeleton.blanks.map((b) => [
            b.id,
            secondsForWords(b.maxWords, config.narrationLang, config.pacing.narrationRate),
          ])
        )
      ).totalSeconds,
      sceneCount: skeleton.scenes.length,
      itemCount: snapshot.items.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function parseSegmentMap(raw: string): Record<string, string> | null {
  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return null;
  }
}

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set — cannot generate narration.");

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek narration call failed: ${res.status} ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Strips anything that would be read aloud badly by a TTS voice. Cheap insurance against a
 * model that ignores the "no markdown" instruction. */
function sanitizeNarration(text: string): string {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GenerateOverrides {
  /** Replaces the resolved system prompt for this run only. */
  systemPrompt?: string;
  /** Per-slot hint and word-budget overrides, keyed by slot id. */
  slots?: Record<string, { hint?: string; maxWords?: number }>;
}

/**
 * How many narration slots go in one request.
 *
 * Generation used to be ONE call for the whole snapshot with `maxTokens` capped at 8000 and no
 * input-size guard, so a whole-level scope (50+ lessons, each embedding its vocabulary, kanji and
 * grammar) became a single enormous prompt. When the response ran out of tokens the missing slots
 * were silently dropped — `.filter(segment => segment.text.trim())` below turned a truncated
 * answer into a shorter video rather than an error.
 *
 * 40 slots costs roughly 3,600 completion tokens at the 90-tokens-per-slot budget, comfortably
 * inside the cap with room for a long system prompt.
 */
const SLOTS_PER_CALL = 40;

/** Concurrent DeepSeek requests. Matches the bound used for lesson block resolution. */
const GENERATION_CONCURRENCY = 3;

interface FilledSlots {
  map: Record<string, string>;
  text: string;
  promptTokens: number;
  completionTokens: number;
  callCount: number;
  /** Slots the model left empty even after a retry. Reported, never silently dropped. */
  missing: string[];
}

/**
 * Fills every narration slot, in as many calls as it takes.
 *
 * Batches are cut on SCENE boundaries, never inside one: a scene's segments are written to follow
 * each other, and splitting them across two independent requests produces two halves of a
 * thought. That means a batch can exceed SLOTS_PER_CALL slightly rather than divide a scene.
 *
 * Each batch is retried once on a slot it left empty, and what is still missing afterwards is
 * reported rather than dropped.
 */
export function planGenerationBatches<T extends { id: string }>(
  scenes: { id: string; narration: { id: string }[] }[],
  slots: T[]
): T[][] {
  // Which scene each slot belongs to, taken from the scenes themselves rather than parsed out of
  // the slot id. Segment ids are prefixed for embedded groups, so a string heuristic would
  // mis-group exactly the lesson scopes this chunking exists for.
  const sceneOfSlot = new Map<string, number>();
  scenes.forEach((scene, i) => {
    for (const segment of scene.narration) sceneOfSlot.set(segment.id, i);
  });

  const bySceneOrder: T[][] = [];
  const sceneIndex = new Map<number, number>();
  for (const slot of slots) {
    const sceneKey = sceneOfSlot.get(slot.id) ?? -1;
    let idx = sceneIndex.get(sceneKey);
    if (idx === undefined) {
      idx = bySceneOrder.length;
      sceneIndex.set(sceneKey, idx);
      bySceneOrder.push([]);
    }
    bySceneOrder[idx].push(slot);
  }

  const batches: T[][] = [];
  let current: T[] = [];
  for (const sceneSlots of bySceneOrder) {
    if (current.length > 0 && current.length + sceneSlots.length > SLOTS_PER_CALL) {
      batches.push(current);
      current = [];
    }
    current.push(...sceneSlots);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * The most planned batches one HTTP request may attempt.
 *
 * MEASURED, not guessed. Against the live API:
 *   4-item topic,  13 slots, 1 batch  ->  1 call,  3.2 s
 *   3-lesson submodule, 43 slots, 2 batches -> 3 calls (one retry), 31.4 s
 *
 * Netlify's real ceiling is ~30 s (docs/ENGINEERING_LOG.md), so that submodule ALREADY exceeds
 * it — which is why this is 2 and not the 3 it started as. A retry is one extra sequential call
 * and cannot be predicted in advance, so the budget has to leave room for one.
 *
 * Chunking makes a big scope CORRECT but not FASTER — a whole N5 level is 2,820 slots across 71
 * calls, which no serverless request can survive. The route refuses above this and says what to
 * do instead, rather than timing out halfway and leaving the project in generating_script
 * forever. That failure mode already exists in this database once.
 */
export const MAX_BATCHES_PER_REQUEST = 2;

async function fillSlots(params: {
  snapshot: ContentSnapshot;
  config: GenerateStoryboardConfig;
  scenes: Scene[];
  slots: BlankSlot[];
  systemPrompt: string;
}): Promise<FilledSlots> {
  const { snapshot, config, scenes, slots, systemPrompt } = params;
  const batches = planGenerationBatches(scenes, slots);

  const map: Record<string, string> = {};
  const texts: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let callCount = 0;

  async function runBatch(batch: BlankSlot[], attempt: number): Promise<void> {
    const userMessage = buildUserMessage(snapshot, config, batch);
    const maxTokens = Math.min(8000, 600 + batch.length * 90);
    const res = await callDeepSeek(systemPrompt, userMessage, maxTokens);
    callCount += 1;
    promptTokens += res.promptTokens;
    completionTokens += res.completionTokens;
    texts.push(res.text);

    const parsed = parseSegmentMap(res.text) ?? {};
    for (const [k, v] of Object.entries(parsed)) map[k] = v;

    // One retry for whatever came back missing, which is usually a truncated response rather
    // than a refusal. Beyond that, leaving it empty is more honest than looping.
    const missing = batch.filter((s) => !map[s.id]);
    if (missing.length > 0 && attempt === 0) await runBatch(missing, 1);
  }

  // Bounded concurrency: a 12-batch level scope runs in ~4 waves instead of 12 sequential
  // round trips, without opening 12 simultaneous connections to DeepSeek.
  for (let i = 0; i < batches.length; i += GENERATION_CONCURRENCY) {
    await Promise.all(batches.slice(i, i + GENERATION_CONCURRENCY).map((b) => runBatch(b, 0)));
  }

  return {
    map,
    text: texts.join("\n"),
    promptTokens,
    completionTokens,
    callCount,
    missing: slots.filter((s) => !map[s.id]).map((s) => s.id),
  };
}

export async function generateStoryboard(
  snapshot: ContentSnapshot,
  config: GenerateStoryboardConfig,
  overrides?: GenerateOverrides
): Promise<GeneratedStoryboard> {
  const startedAt = Date.now();
  const { request, skeleton } = await buildGenerationRequest(snapshot, config);

  // Per-run overrides from the prompt preview panel. Applied here rather than baked into
  // buildGenerationRequest so the preview always shows the unedited baseline first.
  const slots = skeleton.blanks.map((slot) => ({
    ...slot,
    ...(overrides?.slots?.[slot.id]?.hint ? { hint: overrides.slots[slot.id].hint! } : {}),
    ...(overrides?.slots?.[slot.id]?.maxWords ? { maxWords: overrides.slots[slot.id].maxWords! } : {}),
  }));
  const systemPrompt = overrides?.systemPrompt?.trim() || request.systemPrompt;
  const userMessage = overrides ? buildUserMessage(snapshot, config, slots) : request.userMessage;
  const effectiveRequest: GenerationRequest = { ...request, systemPrompt, userMessage, slots };

  const { map, text, promptTokens, completionTokens, callCount, missing } = await fillSlots({
    snapshot,
    config,
    scenes: skeleton.scenes,
    slots,
    systemPrompt,
  });

  const filled = skeleton.scenes.map((scene) => ({
    ...scene,
    narration: scene.narration
      .map((segment) => {
        if (segment.text) return segment;
        const written = map[segment.id];
        return written ? { ...segment, text: sanitizeNarration(written) } : segment;
      })
      // A slot the model skipped becomes an empty segment; drop it so it never produces a
      // zero-length TTS request. `missing` above counts these, so a truncated generation is
      // visible in the audit row rather than just producing a mysteriously short video.
      .filter((segment) => segment.text.trim().length > 0),
  }));

  const storyboard: Storyboard = {
    schemaVersion: 1,
    projectId: config.projectId,
    title: snapshot.title,
    narrationLang: config.narrationLang,
    themeKey: config.themeKey,
    bgm: config.bgm,
    captions: { enabled: true, burnIn: config.burnInCaptions ?? true, style: "bold-center" },
    // Frozen into the document, so re-rendering this version a year from now reproduces the
    // branding it was approved with rather than picking up whatever the constants say then.
    branding: resolveBranding(config.branding),
    scenes: filled,
  };

  return {
    storyboard,
    usage: { promptTokens, completionTokens },
    estimatedCostUsd: promptTokens * PROMPT_COST_PER_TOKEN + completionTokens * COMPLETION_COST_PER_TOKEN,
    model: CHAT_MODEL,
    promptKey: request.promptKey,
    request: effectiveRequest,
    rawResponse: text,
    durationMs: Date.now() - startedAt,
    callCount,
    missingSlots: missing,
  };
}

/**
 * The project's lead character in a given pose, falling back to the fox.
 *
 * `branding.mascot` names a specific id like "shiba-wave", so the character is taken from it and
 * recombined with the pose each bookend needs — picking "shiba-celebrate" for the outro when the
 * lead is "shiba-wave". A combination with no artwork falls back rather than rendering a broken
 * image mid-video.
 */
function leadMascotFor(branding: BrandingSettings, pose: string): MascotId {
  const character = branding.mascot ? String(branding.mascot).replace(/-(wave|point|celebrate|think|write|bow|read)$/, "") : "fox";
  const candidate = `${character}-${pose}`;
  if (isGenerated(candidate)) return candidate;
  if (branding.mascot && isGenerated(String(branding.mascot))) return branding.mascot as MascotId;
  return pose === "celebrate" ? "fox-celebrate" : "fox-wave";
}

/** Stable id for a scene added by hand in the editor. */
export function newSceneId(): string {
  return `sc-${randomUUID().slice(0, 8)}`;
}

/**
 * The domain shown on screen in the outro card.
 *
 * Now a thin wrapper over BRAND.displayUrl, which carries the dev-host guard for every consumer
 * rather than just this one. Kept as a named export because the generate routes call it.
 */
export function outroSiteUrl(): string {
  return BRAND.displayUrl;
}

export { resolvePacing };
