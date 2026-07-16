import { sql } from "@/lib/db";
import type { ContentSnapshot, DraftFinding } from "./types";

// Reuses the exact normalization getContentAudit() (src/lib/admin/contentAudit.ts) and
// triage-content-quality.ts already use for whole-table sweeps, re-scoped here to "does
// anything else share this one entity's normalized key" (cheap, per-entity).
const HIRAGANA_ONLY = /^[ぁ-ゖゝ-ゟー]+$/;
const EXPOSED_NOTES_RE = /imported from|coverage list|draft for|todo|fixme/i;
const RARE_KANJI_MEANING_RE = /radical \(no\.|zodiac|\d+(AM|PM)-\d+(AM|PM)|Turkey|Spain|Iran|Vietnam|Persia/i;

function normalizeGrammarPattern(p: string): string {
  return p
    .replace(/[〜～\s]/g, "")
    .replace(/です|だ|である/g, "")
    .toLowerCase();
}

export interface DeterministicResult {
  hardFail: { reason: string } | null;
  findings: DraftFinding[];
}

// Fallback only — used if content_review_policies has no row for this type (shouldn't
// happen post-migration-107, but keeps this function resilient if the table is ever empty).
const FALLBACK_REQUIRED_FIELDS: Record<string, string[]> = {
  vocabulary: ["word"],
  grammar: ["pattern"],
  kanji: ["character"],
  reading: ["title"],
  listening: ["title"],
  writing: ["title"],
  sounds: ["title"],
};

/** Review Policies: admin-editable required-field lists per content type
 * (content_review_policies table, /admin/review/policies), replacing what used to be a
 * hardcoded map — the spec's "Review rules by content type" section. */
async function getRequiredFields(entityType: string): Promise<string[]> {
  if (!sql) return FALLBACK_REQUIRED_FIELDS[entityType] ?? [];
  const rows = (await sql`SELECT required_fields FROM content_review_policies WHERE content_type = ${entityType}`) as {
    required_fields: string[];
  }[];
  return rows[0]?.required_fields ?? FALLBACK_REQUIRED_FIELDS[entityType] ?? [];
}

export async function runDeterministicChecks(snapshot: ContentSnapshot): Promise<DeterministicResult> {
  const { entityType, sidecar, post } = snapshot;
  const findings: DraftFinding[] = [];

  // Missing-sidecar-row check: syncPostToTypeTable() only handles vocabulary/grammar/kanji/
  // reading/listening and is only called from update/bulk routes, never single-item create —
  // a posts row of a sidecar-backed type can legitimately have no matching sidecar row.
  if (!sidecar) {
    return {
      hardFail: { reason: `No matching ${entityType} row found for post_id=${post.id} — content is incomplete.` },
      findings,
    };
  }

  const requiredFields = await getRequiredFields(entityType);
  for (const fieldName of requiredFields) {
    const value = sidecar[fieldName];
    if (typeof value !== "string" || !value.trim()) {
      return {
        hardFail: { reason: `Required field "${fieldName}" is blank on this ${entityType} entry.` },
        findings,
      };
    }
  }

  // Soft findings below — do not block the job, just get recorded as ordinary findings.
  if (entityType === "vocabulary") {
    const word = String(sidecar.word ?? "");
    const reading = sidecar.reading ? String(sidecar.reading) : null;
    const notes = sidecar.notes ? String(sidecar.notes) : null;

    if (word && HIRAGANA_ONLY.test(word) && word === reading) {
      findings.push({
        severity: "minor",
        category: "data_shape",
        fieldName: "word",
        title: "Hiragana-only word equals its reading",
        description: `"${word}" is hiragana-only and identical to its reading — a common sign of a mis-imported entry. Verify the correct kanji/kana form.`,
        whyItMatters: "A learner sees two identical strings with no distinguishing information, which reads as broken or untrustworthy data rather than a real vocabulary entry.",
      });
    }
    if (word.includes("〜") || word.includes("～")) {
      findings.push({
        severity: "minor",
        category: "data_shape",
        fieldName: "word",
        title: "Vocabulary word looks like a grammar pattern",
        description: `"${word}" contains 〜/～, which usually indicates a grammar pattern stored as vocabulary.`,
        whyItMatters: "A learner studying vocabulary would encounter a mislabeled grammar point instead of a real word, wasting study time on a miscategorized entry.",
      });
    }
    if (notes && EXPOSED_NOTES_RE.test(notes)) {
      findings.push({
        severity: "minor",
        category: "data_shape",
        fieldName: "notes",
        title: "Internal/editorial note may be exposed publicly",
        description: `notes field reads: "${notes}" — confirm this isn't rendered on the public page.`,
        whyItMatters: "An internal editorial note leaking onto a learner-facing page looks unprofessional and could confuse a learner into thinking it's part of the lesson.",
      });
    }

    if (word) {
      const key = `${word.trim().toLowerCase()}|${(reading ?? "").trim().toLowerCase()}`;
      const dupes = sql
        ? ((await sql`
            SELECT v.id FROM vocabulary v
            WHERE lower(trim(v.word)) || '|' || coalesce(lower(trim(v.reading)), '') = ${key}
              AND v.id <> ${sidecar.id}
          `) as { id: string }[])
        : [];
      if (dupes.length > 0) {
        findings.push({
          severity: "major",
          category: "duplicate",
          fieldName: "word",
          title: "Possible duplicate vocabulary entry",
          description: `${dupes.length} other vocabulary row(s) share the same normalized word+reading ("${key}").`,
          whyItMatters: "Duplicate entries fragment a learner's spaced-repetition progress across two records of the same word instead of one, and waste study time relearning it twice.",
        });
      }
    }
  }

  if (entityType === "grammar") {
    const pattern = String(sidecar.pattern ?? "");
    const structure = sidecar.structure ? String(sidecar.structure) : null;

    if (structure && /focus on connection pattern|generic|placeholder|todo/i.test(structure)) {
      findings.push({
        severity: "major",
        category: "data_shape",
        fieldName: "structure",
        title: "Generic/boilerplate structure text",
        description: `structure field reads: "${structure}" — looks like placeholder text rather than a real explanation.`,
        whyItMatters: "A learner relying on this field to understand how the grammar point is formed gets no real information, defeating the purpose of the lesson.",
      });
    }

    if (pattern) {
      const normKey = normalizeGrammarPattern(pattern);
      if (normKey) {
        const dupes = sql
          ? ((await sql`
              SELECT g.id, g.pattern FROM grammar g WHERE g.id <> ${sidecar.id}
            `) as { id: string; pattern: string }[])
          : [];
        const matches = dupes.filter((d) => normalizeGrammarPattern(d.pattern || "") === normKey);
        if (matches.length > 0) {
          findings.push({
            severity: "major",
            category: "duplicate",
            fieldName: "pattern",
            title: "Possible duplicate/overlapping grammar pattern",
            description: `${matches.length} other grammar row(s) normalize to the same pattern ("${normKey}"): ${matches
              .slice(0, 5)
              .map((m) => m.pattern)
              .join(", ")}.`,
            whyItMatters: "A learner studying this pattern may bounce between near-identical entries with slightly different wording, unsure whether they're the same grammar point or genuinely different ones.",
          });
        }
      }
    }
  }

  if (entityType === "kanji") {
    const character = String(sidecar.character ?? "");
    const meaning = sidecar.meaning ? String(sidecar.meaning) : null;

    if (character && Array.from(character).length > 1) {
      findings.push({
        severity: "major",
        category: "taxonomy",
        fieldName: "character",
        title: "Multi-character value in a kanji record",
        description: `"${character}" has more than one character — this looks like a compound word that belongs in vocabulary, not a single kanji.`,
        whyItMatters: "Kanji study is per-character (stroke order, individual readings); showing a compound as if it were one kanji breaks that practice and misrepresents what's actually being taught.",
      });
    }
    if (meaning && RARE_KANJI_MEANING_RE.test(meaning)) {
      findings.push({
        severity: "minor",
        category: "content_type_specific",
        fieldName: "meaning",
        title: "Meaning field leads with a rare/non-learner-relevant sense",
        description: `meaning field reads: "${meaning}" — radical numbers, zodiac signs, countries, or time-period senses read like dictionary trivia rather than the primary learner-facing meaning.`,
        whyItMatters: "A beginner sees an obscure or technical sense first and reasonably concludes that's the character's main meaning, when they actually need the common everyday one.",
      });
    }
    if (character) {
      const dupes = sql
        ? ((await sql`SELECT id FROM kanji WHERE character = ${character} AND id <> ${sidecar.id}`) as { id: string }[])
        : [];
      if (dupes.length > 0) {
        findings.push({
          severity: "major",
          category: "duplicate",
          fieldName: "character",
          title: "Duplicate kanji character",
          description: `${dupes.length} other kanji row(s) use the same character "${character}".`,
          whyItMatters: "Duplicate kanji entries fragment a learner's stroke-order/reading practice across two records of the same character instead of one.",
        });
      }
    }
  }

  // JLPT-level consistency: sidecar level vs. posts.jlpt_level[1].
  const sidecarLevel = (sidecar.level ?? sidecar.jlpt_level) as string | string[] | null | undefined;
  const sidecarLevelStr = Array.isArray(sidecarLevel) ? sidecarLevel[0] : sidecarLevel;
  const postLevel = post.jlptLevel?.[0] ?? null;
  if (sidecarLevelStr && postLevel && sidecarLevelStr !== postLevel) {
    findings.push({
      severity: "minor",
      category: "taxonomy",
      fieldName: "jlpt_level",
      originalValue: { sidecarLevel: sidecarLevelStr, postLevel },
      title: "JLPT level mismatch between sidecar table and posts",
      description: `The ${entityType} table has level "${sidecarLevelStr}" but the posts row's jlpt_level is "${postLevel}".`,
      whyItMatters: "This content could be routed into the wrong level's study plan — either boring a learner with something too easy or overwhelming them with something too advanced.",
    });
  }

  // Gap-fix phase 27: duplicate-slug check. posts.slug has a real case-SENSITIVE unique
  // constraint (posts_slug_key), so byte-identical duplicates are already impossible — but
  // "Foo-Bar" and "foo-bar" can coexist as two rows today, a real duplicate-URL/SEO/routing
  // confusion the DB constraint doesn't catch. Cross-content-type on purpose: a vocabulary
  // and grammar post could collide the same way.
  if (post.slug) {
    const slugDupes = sql
      ? ((await sql`SELECT id, content_type FROM posts WHERE lower(slug) = lower(${post.slug}) AND id <> ${post.id}`) as { id: string; content_type: string }[])
      : [];
    if (slugDupes.length > 0) {
      findings.push({
        severity: "major",
        category: "duplicate",
        fieldName: "slug",
        originalValue: post.slug,
        title: "Slug collides with another post (case-insensitive)",
        description: `${slugDupes.length} other post(s) (${slugDupes.map((d) => d.content_type).join(", ")}) have a slug that matches "${post.slug}" once case is ignored.`,
        whyItMatters: "Case-differing slugs read as duplicate/ambiguous URLs to search engines and learners, splitting traffic and search ranking across what looks like the same page.",
      });
    }
  }

  return { hardFail: null, findings };
}
