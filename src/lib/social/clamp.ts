/**
 * Post-generation enforcement of the platform rules.
 *
 * The prompt asks the model for a length. This module makes it true. Those are different things,
 * and every existing generator in this codebase does only the first — which is why the current
 * social pack cheerfully returns 340-character "tweets".
 *
 * Everything here is pure: no DB, no network, no `next/*`, no `@/` alias. The worker imports it
 * by relative path, and it is the one part of the engine that deserves a unit test.
 */
import type { ClampAction, ClampViolation, SurfaceContent } from "./types";
import { getRule, type FieldRule, type PlatformId, type SocialLang, type SurfaceId } from "./platforms";

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

/**
 * User-perceived character count.
 *
 * `String.length` counts UTF-16 code units, which is wrong in both directions for this content:
 * "👨‍👩‍👧".length is 8 but reads as one character, and every emoji in a caption would eat the
 * budget four times over. Devanagari clusters have the same problem. Platforms count what the
 * reader sees, so we do too.
 *
 * Intl.Segmenter is available in Node 18+ and every browser we target; the fallback to spread
 * (code points, not graphemes) is still far better than `.length`.
 */
const segmenter: Intl.Segmenter | null =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export function countChars(text: string): number {
  if (!text) return 0;
  return graphemes(text).length;
}

/** Graphemes as an array, so slicing never splits an emoji in half. */
function graphemes(text: string): string[] {
  // Array.from over the iterable rather than a for-of: the tsconfig target predates
  // downlevelIteration, and this form compiles without it.
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

// ---------------------------------------------------------------------------
// Trimming
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/\S+/g;

/**
 * Trims to `maxChars` at a word boundary, and never mid-URL.
 *
 * A URL cut in half is worse than no URL: it looks like a link, it is not one, and on X it still
 * costs the full character budget. When the boundary would land inside one, the whole URL is
 * dropped instead.
 */
export function clampAtWord(text: string, maxChars: number): string {
  const chars = graphemes(text.trim());
  if (chars.length <= maxChars) return text.trim();

  // Reserve one grapheme for the ellipsis.
  const budget = Math.max(1, maxChars - 1);
  let cut = chars.slice(0, budget).join("");

  // If the cut landed inside a URL, retreat to before that URL started.
  for (const match of Array.from(text.matchAll(URL_RE))) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (cut.length > start && cut.length < end) {
      cut = text.slice(0, start);
      break;
    }
  }

  const lastSpace = cut.lastIndexOf(" ");
  // Only honour the word boundary if it isn't throwing away most of the text — the same
  // 0.6 heuristic clampTitle() in src/lib/seo.ts uses, for consistency across the codebase.
  const trimmed = lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trim()}…`;
}

/** Models emit markdown even when told not to; a literal `**bold**` in a tweet is embarrassing. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")
    .trim();
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/**
 * Appends the UTM convention from docs/30-day-social-media-promotion-plan.md §5.
 *
 * Built here rather than asked of the model, because a hallucinated tracking parameter is
 * indistinguishable from a real one until the analytics are already wrong.
 */
export function buildUtmLink(
  urlOrPath: string,
  platform: PlatformId,
  campaign: string | null,
  siteUrl: string
): string {
  if (!urlOrPath) return "";
  let url: URL;
  try {
    url = new URL(urlOrPath, urlOrPath.startsWith("http") ? undefined : siteUrl);
  } catch {
    return urlOrPath;
  }
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Hashtags
// ---------------------------------------------------------------------------

function normaliseHashtag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, "");
  // A tag with whitespace or punctuation is not a tag — platforms silently break the link.
  if (!tag || /[\s#.,/\\]/.test(tag)) return null;
  return `#${tag}`;
}

/** Dedupes case-insensitively, drops malformed tags, and enforces the surface's count range. */
export function enforceHashtags(
  raw: string[] | undefined,
  surface: SurfaceId
): { hashtags: string[]; violations: ClampViolation[] } {
  const rule = getRule(surface);
  const violations: ClampViolation[] = [];

  if (rule.hashtags.max === 0) {
    if (raw && raw.length > 0) {
      violations.push({
        field: "hashtags",
        limit: 0,
        was: raw.length,
        action: "clamped",
        note: `${rule.label} does not use hashtags — ${raw.length} removed.`,
      });
    }
    return { hashtags: [], violations };
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const candidate of raw ?? []) {
    const tag = normaliseHashtag(candidate);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(tag);
  }

  if (cleaned.length > rule.hashtags.max) {
    violations.push({
      field: "hashtags",
      limit: rule.hashtags.max,
      was: cleaned.length,
      action: "clamped",
      note: `Kept the first ${rule.hashtags.max}.`,
    });
    return { hashtags: cleaned.slice(0, rule.hashtags.max), violations };
  }

  // Under the minimum is reported, never invented: a made-up hashtag is worse than a missing one.
  if (cleaned.length < rule.hashtags.min) {
    violations.push({
      field: "hashtags",
      limit: rule.hashtags.min,
      was: cleaned.length,
      action: "warned",
      note: `${rule.label} wants at least ${rule.hashtags.min}.`,
    });
  }

  return { hashtags: cleaned, violations };
}

// ---------------------------------------------------------------------------
// The surface pass
// ---------------------------------------------------------------------------

function clampScalar(
  value: string,
  field: FieldRule,
  lang: SocialLang,
  violations: ClampViolation[],
  labelPrefix = ""
): string | null {
  const text = stripMarkdown(value);
  const length = countChars(text);
  if (length <= field.maxChars) return text;

  const action: ClampAction = field.overflow === "reject" ? "rejected" : field.overflow === "warn" ? "warned" : "clamped";
  violations.push({
    field: `${labelPrefix}${field.key}`,
    lang,
    limit: field.maxChars,
    was: length,
    action,
    note:
      action === "rejected"
        ? `${field.label} must fit ${field.maxChars} characters — truncating would break it, so this variant needs a regenerate.`
        : action === "warned"
          ? `${field.label} is over the editorial limit but was kept.`
          : `${field.label} trimmed at a word boundary.`,
  });

  if (action === "warned") return text;
  if (action === "rejected") return null;
  return clampAtWord(text, field.maxChars);
}

/**
 * Applies every rule for a surface to one generated variant.
 *
 * Returns the corrected content plus a report of what changed. The report is stored on the row
 * and rendered in the UI: silent trimming is how you find out at post time that the CTA was cut
 * off, and the whole point of enforcing in code is that the admin can see it happened.
 */
export function enforceSurface(
  surface: SurfaceId,
  lang: SocialLang,
  draft: { content: SurfaceContent; hashtags?: string[] }
): { content: SurfaceContent; hashtags: string[]; violations: ClampViolation[]; rejected: boolean } {
  const rule = getRule(surface);
  const violations: ClampViolation[] = [];
  const content: SurfaceContent = {};
  let rejected = false;

  for (const field of rule.fields) {
    const raw = draft.content?.[field.key];

    if (field.repeatable) {
      const items = Array.isArray(raw) ? raw : [];
      if (items.length < field.repeatable.min || items.length > field.repeatable.max) {
        violations.push({
          field: field.key,
          lang,
          limit: field.repeatable.max,
          was: items.length,
          action: items.length > field.repeatable.max ? "clamped" : "warned",
          note: `${field.label} wants ${field.repeatable.min}-${field.repeatable.max} items, got ${items.length}.`,
        });
      }

      // An item is either a bare string (a thread tweet) or an object (a carousel slide).
      // Handled as two arrays rather than one mixed one, so the stored shape stays uniform —
      // a slides array with a stray string in it would break every consumer downstream.
      const trimmed = items.slice(0, field.repeatable.max);
      const asObjects = trimmed.some((item) => item !== null && typeof item === "object");

      if (asObjects) {
        content[field.key] = trimmed.map((item, i) => {
          const obj = (item ?? {}) as Record<string, unknown>;
          const next: Record<string, string> = {};
          for (const key of field.repeatable!.itemKeys) {
            const v = obj[key];
            if (typeof v !== "string") continue;
            const out = clampScalar(v, field, lang, violations, `${field.key}[${i}].${key} `);
            if (out === null) rejected = true;
            next[key] = out ?? v;
          }
          return next;
        });
      } else {
        content[field.key] = trimmed.map((item, i) => {
          const text = typeof item === "string" ? item : String(item ?? "");
          const out = clampScalar(text, field, lang, violations, `${field.key}[${i}] `);
          if (out === null) rejected = true;
          return out ?? text;
        });
      }
      continue;
    }

    if (typeof raw !== "string" || !raw.trim()) {
      if (field.required) {
        violations.push({
          field: field.key,
          lang,
          limit: field.maxChars,
          was: 0,
          action: "warned",
          note: `${field.label} is required and came back empty.`,
        });
      }
      continue;
    }

    const out = clampScalar(raw, field, lang, violations);
    if (out === null) {
      rejected = true;
      content[field.key] = raw;
      continue;
    }

    if (field.minChars && countChars(out) < field.minChars) {
      violations.push({
        field: field.key,
        lang,
        limit: field.minChars,
        was: countChars(out),
        action: "warned",
        note: `${field.label} is shorter than the ${field.minChars}-character minimum.`,
      });
    }

    content[field.key] = out;
  }

  const tags = enforceHashtags(draft.hashtags, surface);
  violations.push(...tags.violations.map((v) => ({ ...v, lang })));

  return { content, hashtags: tags.hashtags, violations, rejected };
}
