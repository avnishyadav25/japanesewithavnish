import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { LearnEditPageActions } from "@/components/admin/LearnEditPageActions";
import { LearningContentForm } from "@/app/(admin)/admin/learn/LearningContentForm";

export default async function AdminLearnEditPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug: rawSlug } = await params;
  const normalized = type.toLowerCase();
  // Next.js's App Router only auto-decodes a dynamic segment when it's the
  // final path segment. Here [slug] is followed by the literal "edit" segment,
  // so a non-ASCII slug (e.g. Japanese vocabulary) arrives still percent-encoded
  // (e.g. "%E9%99%8D..."). Decode explicitly — a harmless no-op for already-decoded
  // or pure-ASCII slugs, since decodeURIComponent on text with no "%" sequences
  // returns it unchanged.
  const slug = decodeURIComponent(rawSlug);
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, slug, title, content, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order
    FROM posts
    WHERE content_type = ${normalized} AND slug = ${slug}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  const item = {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    content: row.content != null ? String(row.content) : null,
    jlpt_level: row.jlpt_level != null ? String(row.jlpt_level) : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    meta: row.meta != null && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {},
    status: String(row.status ?? "draft"),
    sort_order: Number(row.sort_order) ?? 0,
  };

  const { sidecar, usedInLessons } = await loadSidecarData(normalized, item.id);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <nav className="text-sm text-secondary mb-2 flex items-center gap-2">
            <Link href="/admin" className="hover:text-primary transition">Admin</Link>
            <span className="opacity-50">／</span>
            <Link href={`/admin/learn/${normalized}`} className="hover:text-primary transition">
              {LEARN_TYPE_LABELS[normalized as LearnContentType]}
            </Link>
            <span className="opacity-50">／</span>
            <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
          </nav>
          <h1 className="font-heading text-2xl font-bold text-charcoal">{`Edit ${item.title}`}</h1>
        </div>
        <LearnEditPageActions contentType={normalized} slug={slug} status={item.status} />
      </div>
      <LearningContentForm contentType={normalized} item={item} editBasePath="learn" sidecar={sidecar} usedInLessons={usedInLessons} />
    </div>
  );
}

type UsedInLesson = { lesson_id: string; lesson_title: string; lesson_code: string; module_title: string; level_code: string };

/** Content types with a dedicated editor + a typed curriculum_lesson_* join table (Phase 1: vocab/
 * grammar/kanji; Phase 5: reading/listening/writing/practice_test). Table/column names here are
 * interpolated directly into SQL (via sql.query, not tagged-template params) since identifiers
 * can't be bound parameters — safe because this map is a fixed code-defined allowlist, never
 * user input. */
const SIDECAR_TABLE_CONFIG: Record<string, { table: string; columns: string; joinTable: string; joinColumn: string }> = {
  vocabulary: { table: "vocabulary", columns: "id, word, reading, romaji, meaning, part_of_speech, transitivity, notes", joinTable: "curriculum_lesson_vocabulary", joinColumn: "vocabulary_id" },
  grammar: { table: "grammar", columns: "id, pattern, structure, meaning, when_to_use, notes", joinTable: "curriculum_lesson_grammar", joinColumn: "grammar_id" },
  kanji: { table: "kanji", columns: "id, character, meaning, meaning_extended, onyomi, kunyomi, stroke_count, notes", joinTable: "curriculum_lesson_kanji", joinColumn: "kanji_id" },
  reading: { table: "reading", columns: "id, title, level, notes", joinTable: "curriculum_lesson_reading", joinColumn: "reading_id" },
  listening: { table: "listening", columns: "id, title, level, audio_url, notes", joinTable: "curriculum_lesson_listening", joinColumn: "listening_id" },
  writing: { table: "writing", columns: "id, title, level, notes", joinTable: "curriculum_lesson_writing", joinColumn: "writing_id" },
  practice_test: { table: "practice_tests", columns: "id, duration_minutes, passing_score_percent, instructions, pdf_url, test_variant, attempt_policy", joinTable: "curriculum_lesson_practice_test", joinColumn: "practice_test_id" },
};

/**
 * Loads the sidecar row's own id + structured columns (so the form can bind inputs directly to
 * real columns instead of the loose meta blob) and a read-only "used in these lessons" reverse
 * lookup via the typed curriculum_lesson_* join tables.
 */
async function loadSidecarData(
  contentType: string,
  postId: string
): Promise<{ sidecar: Record<string, unknown> | null; usedInLessons: UsedInLesson[] }> {
  if (!sql) return { sidecar: null, usedInLessons: [] };

  const config = SIDECAR_TABLE_CONFIG[contentType];
  if (!config) return { sidecar: null, usedInLessons: [] };

  const rows = (await sql.query(
    `SELECT ${config.columns} FROM ${config.table} WHERE post_id = $1 LIMIT 1`,
    [postId]
  )) as unknown as Record<string, unknown>[];
  const sidecar = rows[0] ?? null;
  if (!sidecar) return { sidecar: null, usedInLessons: [] };

  const usageRows = (await sql.query(
    `SELECT l.id AS lesson_id, l.title AS lesson_title, l.code AS lesson_code, m.title AS module_title, lv.code AS level_code
     FROM ${config.joinTable} j
     JOIN curriculum_lessons l ON l.id = j.lesson_id
     JOIN curriculum_submodules sm ON sm.id = l.submodule_id
     JOIN curriculum_modules m ON m.id = sm.module_id
     JOIN curriculum_levels lv ON lv.id = m.level_id
     WHERE j."${config.joinColumn}" = $1`,
    [sidecar.id]
  )) as unknown as UsedInLesson[];

  return { sidecar, usedInLessons: usageRows ?? [] };
}
