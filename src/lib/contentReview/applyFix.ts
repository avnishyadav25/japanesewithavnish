import { sql } from "@/lib/db";
import type { ReviewEntityType } from "./types";

export interface ApplyFixResult {
  ok: boolean;
  error?: string;
  preview?: { entityType: ReviewEntityType; postId: string; fieldName: string; valueToApply: unknown };
}

/** Applies one finding's suggested_value (or a human-edited replacement of it, per the
 * spec's "Accept Fix / Edit Fix" distinction) to the live content, scoped to exactly the one
 * field named — never a full-row overwrite, to minimize blast radius from an AI suggestion.
 * This is the human-initiated half of "Auto-draft fixes": a human must click Apply Fix (or
 * edit-then-apply); it never runs automatically, and it never touches posts.status/publishes
 * anything — the post still needs a separate, explicit Approve + Publish, same as any
 * manually-edited content.
 * @param editedValue When provided (the human used "Edit Fix" rather than "Apply Fix" as-is),
 *   this is written instead of the finding's own suggested_value — the finding record itself
 *   is untouched, so the original AI suggestion stays visible in history. */
export async function applyFindingFix(findingId: string, editedValue: unknown | undefined, actor: string, dryRun = false): Promise<ApplyFixResult> {
  if (!sql) return { ok: false, error: "Database unavailable" };

  const findingRows = (await sql`
    SELECT f.id, f.field_name, f.suggested_value, f.status, r.entity_type, r.entity_id
    FROM content_review_findings f
    JOIN content_review_runs r ON r.id = f.review_run_id
    WHERE f.id = ${findingId}
  `) as { id: string; field_name: string | null; suggested_value: unknown; status: string; entity_type: string; entity_id: string }[];

  const finding = findingRows[0];
  if (!finding) return { ok: false, error: "Finding not found" };
  const valueToApply = editedValue !== undefined ? editedValue : finding.suggested_value;
  if (valueToApply === null || valueToApply === undefined || valueToApply === "") {
    return { ok: false, error: "No value to apply — this finding has no suggested_value and no edited value was provided" };
  }
  if (finding.status === "fixed" || finding.status === "false_positive" || finding.status === "rejected") {
    return { ok: false, error: `Finding is already ${finding.status}` };
  }
  if (!finding.field_name) {
    return { ok: false, error: "This finding has no field_name — apply it manually via the content editor" };
  }

  const entityType = finding.entity_type as ReviewEntityType;
  const applied = await applyFieldValue(entityType, finding.entity_id, finding.field_name, valueToApply, dryRun);
  if (!applied.ok) return applied;

  if (dryRun) {
    return { ok: true, preview: { entityType, postId: finding.entity_id, fieldName: finding.field_name, valueToApply } };
  }

  const decisionNote =
    editedValue !== undefined
      ? "Applied via Edit Fix (human-edited value written to live content)"
      : "Applied via Apply Fix (suggested_value written to live content)";
  await sql`UPDATE content_review_findings SET status = 'fixed', applied_fix_at = NOW() WHERE id = ${findingId}`;
  await sql`
    INSERT INTO content_review_decisions (finding_id, decision, decision_note, decided_by)
    VALUES (${findingId}, 'mark_fixed', ${decisionNote}, ${actor})
  `;
  return { ok: true };
}

const POSTS_FIELDS = new Set(["title", "summary", "jlpt_level", "tags", "seo_title", "seo_description"]);

/** Gap-fix phase 25: audio_url is the one URL-shaped field currently auto-applicable via
 * Apply Fix (og_image_url/canonical_url aren't in POSTS_FIELDS's applicable set yet) —
 * writing a garbled/non-URL AI suggestion here would silently break the listening player.
 * Follow this same check if more URL-shaped fields become auto-applicable later. */
function isValidHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

async function applyFieldValue(
  entityType: ReviewEntityType,
  postId: string,
  fieldName: string,
  value: unknown,
  dryRun = false
): Promise<ApplyFixResult> {
  if (!sql) return { ok: false, error: "Database unavailable" };

  if (POSTS_FIELDS.has(fieldName)) {
    return applyPostsField(postId, fieldName, value, dryRun);
  }

  switch (entityType) {
    case "vocabulary":
      return applySidecarField("vocabulary", postId, fieldName, value, ["word", "reading", "meaning", "romaji", "part_of_speech", "transitivity", "notes"], dryRun);
    case "grammar":
      return applySidecarField("grammar", postId, fieldName, value, ["pattern", "structure", "level", "notes"], dryRun);
    case "kanji":
      return applySidecarField("kanji", postId, fieldName, value, ["character", "onyomi", "kunyomi", "meaning", "meaning_extended", "stroke_count"], dryRun);
    case "reading":
      return applySidecarField("reading", postId, fieldName, value, ["title", "notes"], dryRun);
    case "listening":
      return applySidecarField("listening", postId, fieldName, value, ["title", "notes", "audio_url"], dryRun);
    case "writing":
      return applySidecarField("writing", postId, fieldName, value, ["title", "notes"], dryRun);
    case "sounds":
      return applySidecarField("sounds", postId, fieldName, value, ["title", "notes"], dryRun);
    default:
      return { ok: false, error: `Unrecognized entity type: ${entityType}` };
  }
}

/** No-op stand-in for `sql` used in dry-run mode — every switch case below calls `write`
 * instead of `sql` so the exact same validation runs but no UPDATE actually executes. */
type SqlTag = NonNullable<typeof sql>;
async function applyPostsField(postId: string, fieldName: string, value: unknown, dryRun = false): Promise<ApplyFixResult> {
  if (!sql) return { ok: false, error: "Database unavailable" };
  const write: SqlTag = dryRun ? (async () => []) as unknown as SqlTag : sql;
  switch (fieldName) {
    case "title":
      if (typeof value !== "string" || !value.trim()) return { ok: false, error: "suggested_value must be a non-empty string" };
      await write`UPDATE posts SET title = ${value.trim()}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    case "summary":
      await write`UPDATE posts SET summary = ${typeof value === "string" ? value : null}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    case "seo_title":
      await write`UPDATE posts SET seo_title = ${typeof value === "string" ? value : null}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    case "seo_description":
      await write`UPDATE posts SET seo_description = ${typeof value === "string" ? value : null}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    case "tags":
      if (!Array.isArray(value)) return { ok: false, error: "suggested_value for tags must be an array" };
      await write`UPDATE posts SET tags = ${value.map(String)}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    case "jlpt_level": {
      const level = Array.isArray(value) ? value[0] : (value as Record<string, unknown>)?.recommendedLevel ?? value;
      if (typeof level !== "string" || !/^N[1-5]$/.test(level)) return { ok: false, error: "suggested_value for jlpt_level must resolve to N1-N5" };
      await write`UPDATE posts SET jlpt_level = ${[level]}, updated_at = NOW() WHERE id = ${postId}`;
      return { ok: true };
    }
    default:
      return { ok: false, error: `Field "${fieldName}" is not auto-applicable — edit it manually via the content editor` };
  }
}

/** Generic sidecar-table field setter, restricted to the allowlisted columns for the given
 * table — every allowlisted table here has exactly one row per post_id (see the Phase 1
 * migration 100 comment: sidecar tables are UNIQUE on post_id). */
async function applySidecarField(
  table: "vocabulary" | "grammar" | "kanji" | "reading" | "listening" | "writing" | "sounds",
  postId: string,
  fieldName: string,
  value: unknown,
  allowedFields: string[],
  dryRun = false
): Promise<ApplyFixResult> {
  if (!sql) return { ok: false, error: "Database unavailable" };
  const write: SqlTag = dryRun ? (async () => []) as unknown as SqlTag : sql;
  if (!allowedFields.includes(fieldName)) {
    return { ok: false, error: `Field "${fieldName}" is not auto-applicable for ${table} — edit it manually via the content editor` };
  }

  const arrayFields = new Set(["onyomi", "kunyomi"]);
  const numberFields = new Set(["stroke_count"]);

  let normalized: unknown = value;
  if (arrayFields.has(fieldName)) {
    if (!Array.isArray(value)) return { ok: false, error: `suggested_value for ${fieldName} must be an array` };
    normalized = value.map(String);
  } else if (numberFields.has(fieldName)) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: `suggested_value for ${fieldName} must be a number` };
    normalized = n;
  } else if (typeof value !== "string") {
    return { ok: false, error: `suggested_value for ${fieldName} must be a string` };
  }

  // Column name is validated against the allowlist above (never interpolated from
  // unchecked user input) before being spliced into the query text below.
  switch (`${table}.${fieldName}`) {
    case "vocabulary.word":
      await write`UPDATE vocabulary SET word = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.reading":
      await write`UPDATE vocabulary SET reading = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.meaning":
      await write`UPDATE vocabulary SET meaning = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.romaji":
      await write`UPDATE vocabulary SET romaji = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.part_of_speech":
      await write`UPDATE vocabulary SET part_of_speech = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.transitivity":
      if (!["transitive", "intransitive", "both"].includes(normalized as string)) return { ok: false, error: "transitivity must be transitive/intransitive/both" };
      await write`UPDATE vocabulary SET transitivity = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "vocabulary.notes":
      await write`UPDATE vocabulary SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "grammar.pattern":
      await write`UPDATE grammar SET pattern = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "grammar.structure":
      await write`UPDATE grammar SET structure = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "grammar.level":
      await write`UPDATE grammar SET level = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "grammar.notes":
      await write`UPDATE grammar SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.character":
      await write`UPDATE kanji SET character = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.onyomi":
      await write`UPDATE kanji SET onyomi = ${normalized as string[]}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.kunyomi":
      await write`UPDATE kanji SET kunyomi = ${normalized as string[]}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.meaning":
      await write`UPDATE kanji SET meaning = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.meaning_extended":
      await write`UPDATE kanji SET meaning_extended = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "kanji.stroke_count":
      await write`UPDATE kanji SET stroke_count = ${normalized as number}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "reading.title":
      await write`UPDATE reading SET title = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "reading.notes":
      await write`UPDATE reading SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "listening.title":
      await write`UPDATE listening SET title = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "listening.notes":
      await write`UPDATE listening SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "listening.audio_url":
      if (!isValidHttpUrl(normalized as string)) return { ok: false, error: "suggested_value for audio_url is not a valid absolute http(s) URL" };
      await write`UPDATE listening SET audio_url = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "writing.title":
      await write`UPDATE writing SET title = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "writing.notes":
      await write`UPDATE writing SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "sounds.title":
      await write`UPDATE sounds SET title = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    case "sounds.notes":
      await write`UPDATE sounds SET notes = ${normalized as string}, updated_at = NOW() WHERE post_id = ${postId}`;
      return { ok: true };
    default:
      return { ok: false, error: `No apply-fix handler for ${table}.${fieldName}` };
  }
}
