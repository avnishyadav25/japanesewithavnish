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
 */
import { randomUUID } from "crypto";
import { getPromptContent } from "@/lib/ai/load-prompts";
import type {
  ContentItem,
  ContentSnapshot,
  ExampleSentence,
  NarrationLang,
  NarrationSegment,
  Scene,
  Storyboard,
  VocabItem,
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
  tone?: string | null;
  targetDurationSeconds?: number | null;
  bgm?: { trackId: string; gainDb: number; duckDb: number };
  burnInCaptions?: boolean;
  siteName?: string;
  siteUrl?: string;
  /**
   * Insert a real-page B-roll beat before the outro, showing the live page the content came
   * from. Off by default: capture costs a browser launch per video, and a 60-second vocabulary
   * short usually has no room for it. Worth it on longer formats and anything used as
   * marketing, where "this is a real site you can go and use" is the point.
   */
  includeBroll?: boolean;
}

export interface GeneratedStoryboard {
  storyboard: Storyboard;
  usage: { promptTokens: number; completionTokens: number };
  estimatedCostUsd: number;
  model: string;
  promptKey: string;
}

// ---------------------------------------------------------------------------
// Skeleton: visuals + Japanese audio, straight from the DB
// ---------------------------------------------------------------------------

/** A narration slot the LLM is asked to write. `hint` is what it's told the slot is for. */
interface BlankSlot {
  id: string;
  hint: string;
  maxWords: number;
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

/** Japanese narration segment. `spokenAs` carries the kana reading when we have one, which is
 * what keeps the ja-JP voice from guessing between readings of the same kanji. */
function jaSegment(id: string, text: string, reading?: string, leadIn = 0.15): NarrationSegment {
  return {
    id,
    text,
    lang: "ja",
    spokenAs: primaryReading(reading),
    leadInSeconds: leadIn,
    speakingRate: 0.9,
  };
}

function blankSegment(id: string, lang: NarrationLang, leadIn = 0): NarrationSegment {
  return { id, text: "", lang, leadInSeconds: leadIn || undefined };
}

function exampleSpoken(example: ExampleSentence): string | undefined {
  return example.readingKana;
}

interface Skeleton {
  scenes: Scene[];
  blanks: BlankSlot[];
}

function vocabularySkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];
  const items = snapshot.items.map(toVocabItem);
  const level = snapshot.jlptLevel ? `${snapshot.jlptLevel} ` : "";

  // --- Title card -----------------------------------------------------------
  const introId = "sc-intro-nar";
  scenes.push({
    id: "sc-intro",
    sceneType: "title_card",
    durationMode: "auto",
    durationSeconds: 3,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(introId, lang)],
    visual: {
      sceneType: "title_card",
      eyebrow: snapshot.jlptLevel ? `JLPT ${snapshot.jlptLevel}` : undefined,
      title: `${items.length} ${level}words`,
      subtitle: "Japanese vocabulary",
      jlptLevel: snapshot.jlptLevel,
    },
  });
  blanks.push({
    id: introId,
    hint: `Hook for a short video teaching ${items.length} ${level}Japanese vocabulary words. Make someone stop scrolling.`,
    maxWords: 22,
  });

  // --- One card per word ----------------------------------------------------
  items.forEach((item, i) => {
    const base = `sc-w${i + 1}`;
    const narration: NarrationSegment[] = [];

    const leadId = `${base}-lead`;
    narration.push(blankSegment(leadId, lang));
    blanks.push({
      id: leadId,
      hint: `Introduce word ${i + 1} of ${items.length}: "${item.word}" (reading: ${item.reading ?? "n/a"}) meaning "${item.meaning}". Say the meaning naturally. Do NOT attempt to pronounce the Japanese — a native voice speaks it right after you.`,
      maxWords: 18,
    });

    // Deterministic: the word itself, spoken by a native voice, twice for retention.
    narration.push(jaSegment(`${base}-ja1`, item.word, item.reading, 0.25));
    narration.push(jaSegment(`${base}-ja2`, item.word, item.reading, 0.35));

    if (item.example) {
      const exId = `${base}-exlead`;
      narration.push(blankSegment(exId, lang, 0.3));
      blanks.push({
        id: exId,
        hint: `Introduce an example sentence for "${item.word}". The English meaning of the sentence is "${item.example.en}". One short lead-in clause only.`,
        maxWords: 12,
      });
      narration.push(jaSegment(`${base}-exja`, item.example.ja, exampleSpoken(item.example), 0.25));
    }

    scenes.push({
      id: base,
      sceneType: "vocab_card",
      sourceRef: snapshot.items[i].postId
        ? { kind: "post", id: snapshot.items[i].postId!, url: snapshot.items[i].url }
        : undefined,
      durationMode: "auto",
      durationSeconds: 5,
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

  // --- Recap ----------------------------------------------------------------
  if (items.length > 1) {
    const recapId = "sc-recap-nar";
    scenes.push({
      id: "sc-recap",
      sceneType: "summary_recap",
      durationMode: "auto",
      durationSeconds: 4,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(recapId, lang)],
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

  // --- Real-page B-roll -----------------------------------------------------
  const brollUrl = snapshot.items[0]?.url;
  if (config.includeBroll && brollUrl) {
    const brollId = "sc-broll-nar";
    scenes.push({
      id: "sc-broll",
      sceneType: "broll_page",
      sourceRef: snapshot.items[0].postId ? { kind: "post", id: snapshot.items[0].postId!, url: brollUrl } : undefined,
      durationMode: "auto",
      durationSeconds: 5,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(brollId, lang)],
      visual: {
        sceneType: "broll_page",
        sourceUrl: brollUrl,
        captureKind: "scroll_clip",
        caption: "Every word has a full page",
      },
    });
    blanks.push({
      id: brollId,
      hint: "One sentence telling the viewer each of these words has a full page on the site with more examples.",
      maxWords: 20,
    });
  }

  // --- Outro ----------------------------------------------------------------
  const outroId = "sc-outro-nar";
  scenes.push({
    id: "sc-outro",
    sceneType: "cta_outro",
    durationMode: "auto",
    durationSeconds: 3,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(outroId, lang)],
    visual: {
      sceneType: "cta_outro",
      headline: "Practise these on",
      subline: config.siteName ?? "JapaneseWithAvnish",
      url: config.siteUrl ?? "japanesewithavnish.com",
      showLogo: true,
    },
  });
  blanks.push({ id: outroId, hint: "A short closing call to action.", maxWords: 16 });

  return { scenes, blanks };
}

function kanjiSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const d = item.data;
    const character = str(d.character) ?? item.title;
    const meaning = str(d.meaning) ?? item.summary ?? "";
    const onyomi = strArray(d.onyomi);
    const kunyomi = strArray(d.kunyomi);
    // stroke_data is KanjiVG JSON; accept both {paths:[]} and a bare array, since the backfill
    // script and the writing canvas have both shapes in the wild.
    const strokeRaw = d.stroke_data as { paths?: unknown } | unknown[] | null | undefined;
    const strokePaths = Array.isArray(strokeRaw)
      ? strArray(strokeRaw)
      : strArray((strokeRaw as { paths?: unknown } | null)?.paths);

    const base = `sc-k${i + 1}`;
    const exampleWords = Array.isArray(d.exampleWords) ? (d.exampleWords as VocabItem[]) : [];
    const narration: NarrationSegment[] = [];

    const leadId = `${base}-lead`;
    narration.push(blankSegment(leadId, lang));
    blanks.push({
      id: leadId,
      hint: `Introduce the kanji ${character}, which means "${meaning}". Mention it has ${d.stroke_count ?? "several"} strokes.`,
      maxWords: 24,
    });

    // On/kun are stored in dictionary notation — す.き marks where the okurigana starts, and a
    // leading/trailing hyphen marks a prefix/suffix reading. Those marks belong on screen (the
    // scene renders the raw arrays) but a voice reads them aloud as "su dot ki", so speech gets
    // a cleaned copy via spokenAs.
    if (onyomi.length) {
      narration.push(jaSegment(`${base}-on`, onyomi.join("、"), speakableReadings(onyomi), 0.3));
    }
    if (kunyomi.length) {
      narration.push(jaSegment(`${base}-kun`, kunyomi.join("、"), speakableReadings(kunyomi), 0.3));
    }

    // Words that actually use the character. For most kanji this is the only concrete usage the
    // video can show, since only ~5% have example sentences of their own.
    if (exampleWords.length > 0) {
      const wordsLeadId = `${base}-words`;
      narration.push(blankSegment(wordsLeadId, lang, 0.3));
      blanks.push({
        id: wordsLeadId,
        hint: `Introduce real words that use ${character}: ${exampleWords.map((w) => `${w.word} (${w.meaning})`).join(", ")}. Give the meanings; a native voice says the words.`,
        maxWords: 26,
      });
      exampleWords.forEach((word, wi) => {
        narration.push(jaSegment(`${base}-w${wi}`, word.word, word.reading, 0.25));
      });
    }

    scenes.push({
      id: base,
      sceneType: "kanji_stroke",
      sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
      durationMode: "auto",
      durationSeconds: 8,
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
        durationSeconds: 5,
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [
          blankSegment(exLeadId, lang),
          jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), 0.25),
        ],
        visual: { sceneType: "example_sentence", sentences: [example], highlight: [character] },
      });
      blanks.push({
        id: exLeadId,
        hint: `Lead into an example using ${character}. The sentence means "${example.en}".`,
        maxWords: 14,
      });
    });
  });

  return withIntroOutro(scenes, blanks, snapshot, config, `${snapshot.items.length} kanji`);
}

function grammarSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
  const scenes: Scene[] = [];
  const blanks: BlankSlot[] = [];

  snapshot.items.forEach((item, i) => {
    const d = item.data;
    const pattern = str(d.pattern) ?? item.title;
    const meaning = str(d.meaning) ?? item.summary ?? "";
    const base = `sc-g${i + 1}`;

    const leadId = `${base}-lead`;
    const useId = `${base}-use`;
    scenes.push({
      id: base,
      sceneType: "grammar_pattern",
      sourceRef: item.postId ? { kind: "post", id: item.postId, url: item.url } : undefined,
      durationMode: "auto",
      durationSeconds: 8,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [
        blankSegment(leadId, lang),
        jaSegment(`${base}-ja`, pattern, undefined, 0.25),
        blankSegment(useId, lang, 0.3),
      ],
      visual: {
        sceneType: "grammar_pattern",
        pattern,
        meaning,
        structure: str(d.structure),
        level: str(d.level) ?? item.jlptLevel,
        whenToUse: str(d.when_to_use),
      },
    });
    blanks.push({
      id: leadId,
      hint: `Introduce the grammar pattern "${pattern}", which means "${meaning}".`,
      maxWords: 26,
    });
    blanks.push({
      id: useId,
      hint: `Explain when to use "${pattern}".${str(d.when_to_use) ? ` Source note: ${str(d.when_to_use)}` : ""}`,
      maxWords: 34,
    });

    item.examples.slice(0, 3).forEach((example, ei) => {
      const exBase = `${base}-ex${ei + 1}`;
      const exLeadId = `${exBase}-lead`;
      scenes.push({
        id: exBase,
        sceneType: "example_sentence",
        durationMode: "auto",
        durationSeconds: 5,
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [
          blankSegment(exLeadId, lang),
          jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), 0.25),
        ],
        visual: { sceneType: "example_sentence", sentences: [example], highlight: [pattern] },
      });
      blanks.push({
        id: exLeadId,
        hint: `Lead into example ${ei + 1} for "${pattern}". It means "${example.en}".`,
        maxWords: 14,
      });
    });
  });

  return withIntroOutro(scenes, blanks, snapshot, config, snapshot.title);
}

/** Generic fallback: narrate an item's title + summary. Used for reading/listening/writing/
 * sounds/conversation and for curriculum lessons until their dedicated scenes land in Phase 3. */
function genericSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const lang = config.narrationLang;
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
      durationSeconds: 6,
      transitionIn: { kind: "fade", durationSeconds: 0.4 },
      narration: [blankSegment(leadId, lang)],
      visual: {
        sceneType: "title_card",
        eyebrow: item.jlptLevel ? `JLPT ${item.jlptLevel}` : undefined,
        title: item.title,
        subtitle: item.summary?.slice(0, 120),
      },
    });
    blanks.push({
      id: leadId,
      hint: `Explain "${item.title}". ${item.summary ? `Summary: ${item.summary.slice(0, 300)}` : ""}`,
      maxWords: 45,
    });

    item.examples.slice(0, 2).forEach((example, ei) => {
      const exBase = `${base}-ex${ei + 1}`;
      scenes.push({
        id: exBase,
        sceneType: "example_sentence",
        durationMode: "auto",
        durationSeconds: 5,
        transitionIn: { kind: "slide", durationSeconds: 0.3 },
        narration: [jaSegment(`${exBase}-ja`, example.ja, exampleSpoken(example), 0.2)],
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
      narration: [blankSegment(brollId, lang)],
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

  const intro: Scene = {
    id: "sc-intro",
    sceneType: "title_card",
    durationMode: "auto",
    durationSeconds: 3,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(introId, lang)],
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
    durationSeconds: 3,
    transitionIn: { kind: "fade", durationSeconds: 0.4 },
    narration: [blankSegment(outroId, lang)],
    visual: {
      sceneType: "cta_outro",
      headline: "Learn more at",
      subline: config.siteName ?? "JapaneseWithAvnish",
      url: config.siteUrl ?? "japanesewithavnish.com",
      showLogo: true,
    },
  };

  return {
    scenes: [intro, ...scenes, ...brollScenes, outro],
    blanks: [
      { id: introId, hint: `Hook for a video about ${titleText}. Make someone stop scrolling.`, maxWords: 22 },
      ...blanks,
      ...brollBlanks,
      { id: outroId, hint: "A short closing call to action.", maxWords: 16 },
    ],
  };
}

export function buildSkeleton(snapshot: ContentSnapshot, config: GenerateStoryboardConfig): Skeleton {
  const kind = snapshot.items[0]?.kind;
  if (kind === "vocabulary") return vocabularySkeleton(snapshot, config);
  if (kind === "kanji") return kanjiSkeleton(snapshot, config);
  if (kind === "grammar") return grammarSkeleton(snapshot, config);
  return genericSkeleton(snapshot, config);
}

// ---------------------------------------------------------------------------
// Narration: the LLM's only job
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
function defaultSystemPrompt(lang: NarrationLang, tone?: string | null): string {
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
    "- Respect each slot's word limit. These are timed to on-screen beats; going over desynchronises the video.",
    "- Write flowing speech, not headings. One or two sentences per slot.",
    tone ? `\nTone: ${tone}` : "",
    "",
    'Return ONLY a JSON object mapping each slot id to its narration string, e.g. {"sc-intro-nar":"...","sc-w1-lead":"..."}. No markdown fence, no commentary.',
  ]
    .filter(Boolean)
    .join("\n");
}

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

export async function generateStoryboard(
  snapshot: ContentSnapshot,
  config: GenerateStoryboardConfig
): Promise<GeneratedStoryboard> {
  const { scenes, blanks } = buildSkeleton(snapshot, config);
  const kind = snapshot.items[0]?.kind ?? "vocabulary";
  const promptKey = VIDEO_PROMPT_KEY_BY_KIND[kind] ?? "video_narration_shared";

  const dbPrompt = await getPromptContent(promptKey);
  const systemPrompt = dbPrompt || defaultSystemPrompt(config.narrationLang, config.tone);

  const durationNote = config.targetDurationSeconds
    ? `\nTarget total length: about ${config.targetDurationSeconds} seconds of speech. Keep every slot tight.`
    : "";
  const userMessage = [
    `Video title: ${snapshot.title}`,
    snapshot.jlptLevel ? `JLPT level: ${snapshot.jlptLevel}` : "",
    `Content type: ${kind}`,
    durationNote,
    "",
    "Write narration for each slot below. Return a JSON object keyed by slot id.",
    "",
    ...blanks.map((b) => `${b.id} (max ${b.maxWords} words): ${b.hint}`),
  ]
    .filter(Boolean)
    .join("\n");

  // ~40 tokens per slot of output plus headroom for the JSON envelope.
  const maxTokens = Math.min(8000, 600 + blanks.length * 90);
  const { text, promptTokens, completionTokens } = await callDeepSeek(systemPrompt, userMessage, maxTokens);
  const map = parseSegmentMap(text) ?? {};

  const filled = scenes.map((scene) => ({
    ...scene,
    narration: scene.narration
      .map((segment) => {
        if (segment.text) return segment;
        const written = map[segment.id];
        // A slot the model skipped becomes an empty segment, which the timeline treats as zero
        // duration — a silent beat, not a crash. The editor shows it as blank so a human can fill it.
        return written ? { ...segment, text: sanitizeNarration(written) } : segment;
      })
      // Drop blank slots entirely so they don't produce zero-length TTS requests.
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
    scenes: filled,
  };

  return {
    storyboard,
    usage: { promptTokens, completionTokens },
    estimatedCostUsd: promptTokens * PROMPT_COST_PER_TOKEN + completionTokens * COMPLETION_COST_PER_TOKEN,
    model: CHAT_MODEL,
    promptKey,
  };
}

/** Stable id for a scene added by hand in the editor. */
export function newSceneId(): string {
  return `sc-${randomUUID().slice(0, 8)}`;
}

const PRODUCTION_DOMAIN = "japanesewithavnish.com";

/**
 * The domain shown on screen in the outro card.
 *
 * Deliberately NOT just `NEXT_PUBLIC_SITE_URL`: on a developer machine that is
 * `http://localhost:3000`, and a video generated there would burn "localhost:3000" into a card
 * that ends up on YouTube. A dev-only host is ignored in favour of the real domain, since the
 * outro is brand copy rather than a functional link.
 */
export function outroSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw || /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|\/|$)/i.test(raw)) return PRODUCTION_DOMAIN;
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
