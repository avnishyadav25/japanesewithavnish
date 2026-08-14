/**
 * Per-surface copy generation.
 *
 * Modelled directly on src/lib/video/storyboard.ts, which is the one generator in this codebase
 * that reliably produces structured output. Three things are copied deliberately:
 *
 *   1. `buildSocialRequest()` is split out, so a /preview endpoint can show the exact prompt
 *      without spending a token, and the preview cannot drift from what actually runs.
 *   2. The model is handed a skeleton with named blanks and an explicit budget per blank, rather
 *      than a paragraph of instructions and a hope.
 *   3. Every run is recorded verbatim — failures included.
 *
 * ONE CALL PER SURFACE, NOT ONE MEGA-CALL. /api/ai/social-pack asks for every platform in one
 * ~100-key response, and scripts/fill-missing-social-platforms.ts exists precisely because that
 * silently drops keys. A surface is 2-5 fields; that is a different problem.
 *
 * BOTH LANGUAGES IN ONE CALL, usually. English and Hinglish for a 3-field surface is 6 keys,
 * nowhere near the size that fails, and asking once keeps the two variants saying the same thing
 * rather than drifting into two different posts. Surfaces whose payload is genuinely large
 * (carousels, threads, articles) set `splitByLanguage` and get one call each. Where a language
 * does come back missing, `repairSurfaceLang()` re-asks for just that one — the fill-missing
 * script promoted from a one-off into the engine.
 */
import { randomUUID } from "crypto";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { CHAT_MODEL, callDeepSeekJson, parseJsonResponse } from "@/lib/ai/deepseek";
import { BRAND } from "../brand";
import { buildUtmLink, countChars, enforceSurface } from "./clamp";
import { pickHashtags } from "./hashtags";
import { getRule, type SocialLang, type SurfaceId } from "./platforms";
import type {
  ClampViolation,
  SocialBriefFacts,
  SocialGenerationRunInput,
  SurfaceContent,
} from "./types";

const SHARED_PROMPT_KEY = "social_shared_brand";

export interface SocialGenerationRequest {
  systemPrompt: string;
  userMessage: string;
  promptKey: string;
  model: string;
  maxTokens: number;
  surface: SurfaceId;
  langs: SocialLang[];
  /** The exact JSON keys demanded, echoed by the preview panel. */
  schemaKeys: string[];
  budgets: { field: string; maxChars: number; repeatable?: string }[];
  hashtagRange: { min: number; max: number };
  /** Chosen in code, not by the model — shown so the admin can see what will be attached. */
  suggestedHashtags: string[];
}

export interface GenerateSurfaceOverrides {
  /** Replaces the resolved system prompt for this run only. */
  systemPrompt?: string;
  /** Appended to the user message — "make it funnier", "mention the free trial". */
  extraInstructions?: string;
  temperature?: number;
}

export interface GeneratedVariant {
  content: SurfaceContent;
  hashtags: string[];
  violations: ClampViolation[];
  rejected: boolean;
}

export interface GeneratedSurface {
  surface: SurfaceId;
  variants: Partial<Record<SocialLang, GeneratedVariant>>;
  missingLangs: SocialLang[];
  usage: { promptTokens: number; completionTokens: number };
  estimatedCostUsd: number;
  model: string;
  promptKey: string;
  request: SocialGenerationRequest;
  rawResponse: string;
  durationMs: number;
  status: SocialGenerationRunInput["status"];
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function describeFields(surface: SurfaceId): { schemaKeys: string[]; budgets: SocialGenerationRequest["budgets"]; lines: string[] } {
  const rule = getRule(surface);
  const schemaKeys: string[] = [];
  const budgets: SocialGenerationRequest["budgets"] = [];
  const lines: string[] = [];

  for (const field of rule.fields) {
    schemaKeys.push(field.key);
    if (field.repeatable) {
      budgets.push({ field: field.key, maxChars: field.maxChars, repeatable: field.repeatable.itemKeys.join("+") });
      lines.push(
        `- "${field.key}": array of ${field.repeatable.min}-${field.repeatable.max} objects, each with ` +
          `${field.repeatable.itemKeys.map((k) => `"${k}"`).join(" and ")}. ` +
          `Every one of those values must be ${field.maxChars} characters or fewer.`
      );
      continue;
    }
    budgets.push({ field: field.key, maxChars: field.maxChars });
    // Reject-mode fields cannot be trimmed to fit — a tweet cut mid-thought loses its ending,
    // which is usually the whole point of it — so overshooting discards the variant. Say so, and
    // aim below the cap rather than at it. Two of two smoke-test tweets came back over 280 when
    // the instruction was just "write close to the limit".
    const hard =
      field.overflow === "reject"
        ? `MUST be at most ${field.maxChars} characters, counted as a reader sees them. Going over ` +
          `means this is discarded and regenerated, so aim for about ${Math.floor(field.maxChars * 0.9)} ` +
          `and count as you write.`
        : `Hard limit ${field.maxChars} characters — write close to it, not far under.`;
    lines.push(`- "${field.key}": ${field.label}${field.required ? "" : " (optional)"}. ${hard}`);
  }

  return { schemaKeys, budgets, lines };
}

function defaultSystemPrompt(surface: SurfaceId): string {
  const rule = getRule(surface);
  return [
    `You write social copy for ${BRAND.name}, a JLPT-focused Japanese learning site.`,
    ``,
    `You are writing for: ${rule.label}.`,
    `Tone: ${rule.tone}`,
    rule.allowed.length ? `Do: ${rule.allowed.join("; ")}.` : "",
    rule.forbidden.length ? `Never: ${rule.forbidden.join("; ")}.` : "",
    rule.linksClickable
      ? `Links are clickable on this platform — include the link naturally.`
      : `Links are NOT clickable on this platform. Never paste a URL; say "link in bio" instead.`,
    ``,
    `Any Japanese you write must be correct. If you are unsure of a reading or a particle, leave`,
    `it out rather than guessing — a wrong particle in a caption is as damaging as one on a lesson page.`,
    `Write plain text. No markdown, no asterisks, no headings.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function languageBrief(lang: SocialLang): string {
  return lang === "en"
    ? `"en": natural English.`
    : `"hinglish": romanised Hindi-English as an Indian learner actually speaks it — Hindi ` +
        `connectives and verbs carrying English nouns and technical words. For example: ` +
        `"yeh 10 words roz kaam aayenge", "iska matlab hai", "yaad rakhna easy hai". ` +
        `Latin script only, never Devanagari — it would blow the character budget. ` +
        `THIS MUST NOT BE THE ENGLISH TEXT REPEATED. Same meaning and same structure as the ` +
        `English version, but genuinely written in Hinglish. If a sentence comes out identical ` +
        `to the English one, you have not done this correctly.`;
}

/**
 * How much two strings overlap, 0-1, on a word-set basis.
 *
 * Used to catch the model returning English under the "hinglish" key. It happens: the smoke run
 * that motivated this had an Instagram hook byte-identical across both languages while the X
 * post for the same brief was properly Hinglish. `status` was "ok" because the key was present,
 * which is exactly the sort of silent pass this engine is supposed to stop making.
 */
function similarity(a: string, b: string): number {
  // Punctuation stripped by enumeration rather than a \p{L} class: the tsconfig target predates
  // unicode property escapes, and enumerating also leaves Japanese and Devanagari intact, which
  // is the point — a caption is mostly those.
  const wordsOf = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:'"“”‘’()[\]{}—–\-/\\|]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const wa = wordsOf(a);
  const wb = new Set(wordsOf(b));
  if (wa.length === 0 || wb.size === 0) return 0;

  const seen = new Set<string>();
  let shared = 0;
  for (const w of wa) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (wb.has(w)) shared += 1;
  }
  return shared / Math.max(seen.size, wb.size);
}

/** Longest text field, for the language-drift comparison. */
function longestText(content: SurfaceContent): string {
  let best = "";
  for (const value of Object.values(content)) {
    if (typeof value === "string" && value.length > best.length) best = value;
  }
  return best;
}

/**
 * Flags a Hinglish variant that is really just the English one.
 *
 * Reported rather than rejected: it is still usable copy, and a false positive on a
 * loanword-heavy post should not throw away a generation. The admin sees the warning and can
 * regenerate that one surface.
 */
const LANG_DRIFT_THRESHOLD = 0.85;

export function detectLanguageDrift(
  variants: Partial<Record<SocialLang, GeneratedVariant>>
): ClampViolation | null {
  const en = variants.en;
  const hi = variants.hinglish;
  if (!en || !hi) return null;

  const overlap = similarity(longestText(en.content), longestText(hi.content));
  if (overlap < LANG_DRIFT_THRESHOLD) return null;

  return {
    field: "hinglish",
    lang: "hinglish",
    limit: Math.round(LANG_DRIFT_THRESHOLD * 100),
    was: Math.round(overlap * 100),
    action: "warned",
    note: `The Hinglish variant is ${Math.round(overlap * 100)}% the same as the English one — the model likely returned English twice. Regenerate this surface, or edit it by hand.`,
  };
}

/**
 * Everything that would be sent, without sending it.
 *
 * The /preview route renders this and `generateSurface()` consumes the same object, so what you
 * inspect is exactly what runs.
 */
export async function buildSocialRequest(
  facts: SocialBriefFacts,
  surface: SurfaceId,
  langs: SocialLang[],
  overrides?: GenerateSurfaceOverrides
): Promise<SocialGenerationRequest> {
  const rule = getRule(surface);
  const { schemaKeys, budgets, lines } = describeFields(surface);

  const shared = (await getPromptContent(SHARED_PROMPT_KEY)) ?? "";
  const surfacePrompt = (await getPromptContent(rule.generation.promptKey)) ?? defaultSystemPrompt(surface);
  const systemPrompt = overrides?.systemPrompt ?? [shared, surfacePrompt].filter(Boolean).join("\n\n");

  const link = facts.linkUrl
    ? rule.linksClickable
      ? `Link to include: ${facts.linkUrl}`
      : `Link (do NOT paste it — the caption should say "link in bio"): ${facts.linkUrl}`
    : "";

  const suggestedHashtags = pickHashtags({
    surface,
    jlptLevel: facts.jlptLevel,
    contentType: facts.contentType,
    seed: facts.title,
  });

  const userMessage = [
    `CONTENT TO PROMOTE`,
    `Title: ${facts.title}`,
    facts.jlptLevel ? `JLPT level: ${facts.jlptLevel}` : "",
    facts.contentType ? `Content type: ${facts.contentType}` : "",
    facts.summary ? `Summary: ${facts.summary}` : "",
    facts.mediaSummary ? `Attached media: ${facts.mediaSummary}` : "",
    link,
    facts.bodyContext ? `\nSOURCE MATERIAL (use these facts; do not invent others)\n${facts.bodyContext}` : "",
    ``,
    `WRITE`,
    ...lines,
    rule.hashtags.max > 0
      ? `- "hashtags": ${rule.hashtags.min}-${rule.hashtags.max} tags. Prefer these, which are already chosen for this post: ${suggestedHashtags.join(" ")}`
      : `- Do not include hashtags. This platform does not use them.`,
    ``,
    `LANGUAGES — return one object per language:`,
    ...langs.map((l) => `- ${languageBrief(l)}`),
    ``,
    `Return JSON shaped exactly like this and nothing else:`,
    `{`,
    ...langs.map(
      (l, i) =>
        `  "${l}": { ${schemaKeys.map((k) => `"${k}": …`).join(", ")}${rule.hashtags.max > 0 ? `, "hashtags": ["#…"]` : ""} }${i < langs.length - 1 ? "," : ""}`
    ),
    `}`,
    overrides?.extraInstructions ? `\nADDITIONAL INSTRUCTIONS\n${overrides.extraInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    systemPrompt,
    userMessage,
    promptKey: rule.generation.promptKey,
    model: CHAT_MODEL,
    maxTokens: rule.generation.maxTokens,
    surface,
    langs,
    schemaKeys,
    budgets,
    hashtagRange: rule.hashtags,
    suggestedHashtags,
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function extractLang(parsed: unknown, lang: SocialLang): { content: SurfaceContent; hashtags: string[] } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const block = (parsed as Record<string, unknown>)[lang];
  if (!block || typeof block !== "object") return null;
  const record = block as Record<string, unknown>;
  const hashtags = Array.isArray(record.hashtags) ? (record.hashtags.filter((h) => typeof h === "string") as string[]) : [];
  const content: SurfaceContent = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "hashtags") continue;
    if (typeof value === "string" || Array.isArray(value)) content[key] = value as SurfaceContent[string];
  }
  return Object.keys(content).length > 0 ? { content, hashtags } : null;
}

/** Generates one surface, in one or both languages, clamped and ready to store. */
export async function generateSurface(
  facts: SocialBriefFacts,
  surface: SurfaceId,
  langs: SocialLang[],
  overrides?: GenerateSurfaceOverrides
): Promise<GeneratedSurface> {
  const request = await buildSocialRequest(facts, surface, langs, overrides);
  const base: Omit<GeneratedSurface, "variants" | "missingLangs" | "status" | "errorMessage" | "rawResponse"> = {
    surface,
    usage: { promptTokens: 0, completionTokens: 0 },
    estimatedCostUsd: 0,
    model: request.model,
    promptKey: request.promptKey,
    request,
    durationMs: 0,
  };

  let result;
  try {
    result = await callDeepSeekJson({
      systemPrompt: request.systemPrompt,
      userMessage: request.userMessage,
      maxTokens: request.maxTokens,
      temperature: overrides?.temperature ?? 0.7,
      timeoutMs: 90_000,
    });
  } catch (err) {
    return {
      ...base,
      variants: {},
      missingLangs: langs,
      rawResponse: "",
      status: "api_error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  base.usage = { promptTokens: result.promptTokens, completionTokens: result.completionTokens };
  base.estimatedCostUsd = result.estimatedCostUsd;
  base.durationMs = result.durationMs;

  let parsed: unknown;
  try {
    parsed = parseJsonResponse(result.text);
  } catch (err) {
    return {
      ...base,
      variants: {},
      missingLangs: langs,
      rawResponse: result.text,
      status: "parse_failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const variants: Partial<Record<SocialLang, GeneratedVariant>> = {};
  const missingLangs: SocialLang[] = [];
  let anyClamped = false;

  for (const lang of langs) {
    const raw = extractLang(parsed, lang);
    if (!raw) {
      missingLangs.push(lang);
      continue;
    }
    // Enforcement, not persuasion: the prompt asked for a length, this makes it true.
    const enforced = enforceSurface(surface, lang, raw);
    if (enforced.violations.length > 0) anyClamped = true;
    variants[lang] = {
      content: enforced.content,
      hashtags: enforced.hashtags.length > 0 ? enforced.hashtags : request.suggestedHashtags,
      violations: enforced.violations,
      rejected: enforced.rejected,
    };
  }

  // The model can return English under the "hinglish" key and still look successful. Attach the
  // warning to the Hinglish variant so it surfaces in the UI alongside the clamp report.
  const drift = detectLanguageDrift(variants);
  if (drift && variants.hinglish) {
    variants.hinglish.violations = [...variants.hinglish.violations, drift];
    anyClamped = true;
  }

  return {
    ...base,
    variants,
    missingLangs,
    rawResponse: result.text,
    status: anyClamped ? "clamped" : "ok",
    errorMessage: null,
  };
}

/**
 * Re-asks for a single language that came back missing.
 *
 * This is scripts/fill-missing-social-platforms.ts as a first-class part of the engine rather
 * than a script somebody has to remember to run. Recorded with kind='repair' so the rate is
 * visible: if one surface keeps needing repair, flip its `splitByLanguage` flag — a decision the
 * data should make, not an opinion.
 */
export async function repairSurfaceLang(
  facts: SocialBriefFacts,
  surface: SurfaceId,
  lang: SocialLang,
  overrides?: GenerateSurfaceOverrides
): Promise<GeneratedSurface> {
  return generateSurface(facts, surface, [lang], overrides);
}

/** A batch id groups the calls behind one click, so the UI can show a single cost figure. */
export function newBatchId(): string {
  return randomUUID();
}

/** Attaches per-platform UTM parameters to a brief's link. */
export function factsForSurface(
  facts: Omit<SocialBriefFacts, "linkUrl"> & { linkPath: string | null; utmCampaign: string | null },
  surface: SurfaceId
): SocialBriefFacts {
  const rule = getRule(surface);
  return {
    ...facts,
    linkUrl: facts.linkPath ? buildUtmLink(facts.linkPath, rule.platform, facts.utmCampaign, BRAND.siteUrl) : null,
  };
}

/** Rough pre-flight cost, for the confirm dialog on "generate all surfaces". */
export function estimateBatchCostUsd(surfaces: SurfaceId[], langs: SocialLang[]): number {
  return surfaces.reduce((total, surface) => {
    const rule = getRule(surface);
    const calls = rule.generation.splitByLanguage ? langs.length : 1;
    // ~900 prompt tokens per call is typical for a brief with source material attached.
    const promptTokens = 900 * calls;
    const completionTokens = rule.generation.maxTokens * 0.55 * calls;
    return total + promptTokens * (0.14 / 1_000_000) + completionTokens * (0.28 / 1_000_000);
  }, 0);
}

export { countChars };
