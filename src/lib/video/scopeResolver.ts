/**
 * Video Studio — resolves a project's scope into a normalised ContentSnapshot.
 *
 * This is the input to storyboard generation. It deliberately mirrors the query set that
 * src/components/learn/LearnDetailContent.tsx assembles for a public page — same sidecar
 * overlay, same "sidecar examples beat posts.meta.examples" precedence — so a video never
 * teaches something different from the page it was generated from.
 *
 * Block-bearing content reuses the existing FK-resolving readers (getResolvedContentBlocks /
 * getResolvedLessonBlocks) rather than re-querying blocks by hand; they already batch the
 * vocabulary/grammar/kanji/kana/example lookups.
 */
import { sql } from "@/lib/db";
import { getResolvedContentBlocks } from "@/lib/blocks/getContentBlocks";
import { getResolvedLessonBlocks } from "@/lib/curriculum/getLessonBlocks";
import type { BlockType } from "@/lib/blocks/blockTypes";
import type { ContentItem, ContentSnapshot, ExampleSentence, ScopeKind, ScopeRef } from "./types";

/** Sidecar table + the columns worth putting on screen, per content_type. */
const SIDECARS: Record<string, { table: string; columns: string[]; exampleFk?: string }> = {
  vocabulary: {
    table: "vocabulary",
    columns: ["word", "reading", "meaning", "romaji", "part_of_speech", "transitivity", "notes"],
    exampleFk: "vocabulary_id",
  },
  grammar: {
    table: "grammar",
    columns: ["pattern", "structure", "level", "meaning", "when_to_use", "notes"],
    exampleFk: "grammar_id",
  },
  kanji: {
    table: "kanji",
    columns: ["character", "onyomi", "kunyomi", "stroke_count", "meaning", "meaning_extended", "notes", "stroke_data"],
    exampleFk: "kanji_id",
  },
  reading: { table: "reading", columns: ["title", "level", "notes", "reading_kind"] },
  listening: { table: "listening", columns: ["title", "level", "audio_url", "notes"] },
  writing: { table: "writing", columns: ["title", "level", "notes"] },
  sounds: { table: "sounds", columns: ["title", "level", "notes"] },
  practice_test: {
    table: "practice_tests",
    columns: ["duration_minutes", "passing_score_percent", "instructions", "test_variant"],
  },
};

/** Matches src/app/sitemap.ts: study_guide lives under /blog, everything else under /learn. */
export function publicUrlFor(contentType: string, slug: string): string {
  if (contentType === "study_guide") return `/blog/study_guide/${slug}`;
  return `/learn/${contentType}/${slug}`;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  jlpt_level: string | null;
  content_type: string;
  meta: Record<string, unknown> | null;
  sidecar_id: string | null;
  [key: string]: unknown;
}

function normalizeExamples(rows: { sentence_ja: string; sentence_romaji: string | null; sentence_en: string | null }[]): ExampleSentence[] {
  return rows
    .filter((r) => r.sentence_ja)
    .map((r) => ({ ja: r.sentence_ja, romaji: r.sentence_romaji ?? undefined, en: r.sentence_en ?? "" }));
}

/** posts.meta.examples is the legacy shape and its keys drifted over time; accept the variants
 * that actually appear rather than assuming one. Sidecar rows win when both exist. */
function examplesFromMeta(meta: Record<string, unknown> | null): ExampleSentence[] {
  const raw = meta?.examples;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): ExampleSentence | null => {
      const e = entry as Record<string, unknown>;
      const ja = (e.japanese ?? e.ja ?? e.sentence_ja ?? e.sentence) as string | undefined;
      if (!ja) return null;
      return {
        ja,
        romaji: (e.romaji ?? e.sentence_romaji) as string | undefined,
        en: ((e.english ?? e.en ?? e.sentence_en ?? "") as string) || "",
      };
    })
    .filter((e): e is ExampleSentence => e !== null);
}

async function fetchSidecarExamples(contentType: string, sidecarIds: string[]): Promise<Map<string, ExampleSentence[]>> {
  const spec = SIDECARS[contentType];
  const byId = new Map<string, ExampleSentence[]>();
  if (!sql || !spec?.exampleFk || sidecarIds.length === 0) return byId;

  const rows = (await sql.query(
    `SELECT ${spec.exampleFk} AS owner_id, sentence_ja, sentence_romaji, sentence_en
     FROM examples
     WHERE ${spec.exampleFk} = ANY($1::uuid[])
     ORDER BY sort_order, id`,
    [sidecarIds]
  )) as { owner_id: string; sentence_ja: string; sentence_romaji: string | null; sentence_en: string | null }[];

  for (const row of rows) {
    const list = byId.get(row.owner_id) ?? [];
    list.push(...normalizeExamples([row]));
    byId.set(row.owner_id, list);
  }
  return byId;
}

async function toContentItems(rows: PostRow[], contentType: string, includeBlocks: boolean): Promise<ContentItem[]> {
  const spec = SIDECARS[contentType];
  const sidecarIds = rows.map((r) => r.sidecar_id).filter((id): id is string => Boolean(id));
  const examplesBySidecar = await fetchSidecarExamples(contentType, sidecarIds);

  const items: ContentItem[] = [];
  for (const row of rows) {
    const data: Record<string, unknown> = {};
    for (const col of spec?.columns ?? []) data[col] = row[col];

    const sidecarExamples = row.sidecar_id ? examplesBySidecar.get(row.sidecar_id) ?? [] : [];
    // Sidecar rows are authoritative; meta is only a fallback for items never migrated.
    const examples = sidecarExamples.length > 0 ? sidecarExamples : examplesFromMeta(row.meta);

    let blocks: { blockType: BlockType; data: Record<string, unknown> }[] = [];
    if (includeBlocks) {
      const resolved = await getResolvedContentBlocks(row.id);
      blocks = resolved.blocks.map((b) => ({ blockType: b.blockType, data: { ...b.data, __resolved: b.resolved } }));
    }

    items.push({
      kind: contentType as ContentItem["kind"],
      postId: row.id,
      slug: row.slug,
      url: publicUrlFor(contentType, row.slug),
      title: row.title,
      summary: row.summary ?? undefined,
      jlptLevel: row.jlpt_level ?? undefined,
      data: { ...data, meta: row.meta ?? {} },
      examples,
      blocks,
    });
  }
  return items;
}

async function queryPosts(params: {
  contentType: string;
  jlptLevel?: string;
  tags?: string[];
  limit?: number;
  postIds?: string[];
}): Promise<PostRow[]> {
  if (!sql) return [];
  const spec = SIDECARS[params.contentType];
  if (!spec) throw new Error(`Unsupported content type for video generation: ${params.contentType}`);

  const sidecarCols = spec.columns.map((c) => `s.${c}`).join(", ");
  const where: string[] = ["p.content_type = $1", "p.status = 'published'"];
  const values: unknown[] = [params.contentType];

  if (params.postIds?.length) {
    values.push(params.postIds);
    where.push(`p.id = ANY($${values.length}::uuid[])`);
  }
  if (params.jlptLevel) {
    values.push(params.jlptLevel);
    // jlpt_level is TEXT[] everywhere but is always read as its first element.
    where.push(`(p.jlpt_level)[1] = $${values.length}`);
  }
  if (params.tags?.length) {
    values.push(params.tags);
    where.push(`p.tags && $${values.length}::text[]`);
  }

  let limitClause = "";
  if (params.limit && params.limit > 0) {
    values.push(params.limit);
    limitClause = `LIMIT $${values.length}`;
  }

  return (await sql.query(
    `SELECT p.id, p.slug, p.title, p.summary, (p.jlpt_level)[1] AS jlpt_level, p.content_type, p.meta,
            s.id AS sidecar_id, ${sidecarCols}
     FROM posts p
     JOIN ${spec.table} s ON s.post_id = p.id
     WHERE ${where.join(" AND ")}
     ORDER BY p.sort_order, p.created_at
     ${limitClause}`,
    values
  )) as PostRow[];
}

async function resolveLessonItems(lessonIds: string[]): Promise<ContentItem[]> {
  if (!sql || lessonIds.length === 0) return [];
  const lessons = (await sql.query(
    `SELECT l.id, l.code, l.title, l.slug, l.goal, l.introduction, l.summary, l.content_type,
            l.estimated_minutes, sm.title AS submodule_title, m.title AS module_title, lv.code AS level_code
     FROM curriculum_lessons l
     JOIN curriculum_submodules sm ON sm.id = l.submodule_id
     JOIN curriculum_modules m ON m.id = sm.module_id
     JOIN curriculum_levels lv ON lv.id = m.level_id
     WHERE l.id = ANY($1::uuid[])
     ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order`,
    [lessonIds]
  )) as Record<string, string | number | null>[];

  const items: ContentItem[] = [];
  for (const lesson of lessons) {
    const lessonId = String(lesson.id);
    const resolved = await getResolvedLessonBlocks(lessonId);
    const objectives = (await sql.query(
      `SELECT objective_text FROM learning_objectives WHERE lesson_id = $1::uuid ORDER BY sort_order`,
      [lessonId]
    )) as { objective_text: string }[];

    items.push({
      kind: "lesson",
      slug: (lesson.slug as string) ?? undefined,
      url: `/learn/curriculum/lesson/${lesson.slug || lessonId}`,
      title: String(lesson.title ?? lesson.code ?? "Lesson"),
      summary: (lesson.summary as string) ?? (lesson.goal as string) ?? undefined,
      jlptLevel: (lesson.level_code as string) ?? undefined,
      data: {
        lessonId,
        code: lesson.code,
        goal: lesson.goal,
        introduction: lesson.introduction,
        contentType: lesson.content_type,
        estimatedMinutes: lesson.estimated_minutes,
        moduleTitle: lesson.module_title,
        submoduleTitle: lesson.submodule_title,
        objectives: objectives.map((o) => o.objective_text),
      },
      examples: [],
      blocks: resolved.blocks.map((b) => ({ blockType: b.blockType, data: { ...b.data, __resolved: b.resolved } })),
    });
  }
  return items;
}

/** Walks a curriculum node down to its lesson ids. */
async function lessonIdsUnder(scopeKind: ScopeKind, ref: ScopeRef): Promise<string[]> {
  if (!sql) return [];
  if (scopeKind === "curriculum_lesson") return ref.lessonId ? [ref.lessonId] : [];

  const joins = `
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id`;
  const order = "ORDER BY m.sort_order, sm.sort_order, l.sort_order";

  if (scopeKind === "curriculum_submodule" && ref.submoduleId) {
    const rows = (await sql.query(
      `SELECT l.id ${joins} WHERE sm.id = $1::uuid ${order}`, [ref.submoduleId]
    )) as { id: string }[];
    return rows.map((r) => r.id);
  }
  if (scopeKind === "curriculum_module" && ref.moduleId) {
    const rows = (await sql.query(
      `SELECT l.id ${joins} WHERE m.id = $1::uuid ${order}`, [ref.moduleId]
    )) as { id: string }[];
    return rows.map((r) => r.id);
  }
  if (scopeKind === "curriculum_level" && ref.levelId) {
    const rows = (await sql.query(
      `SELECT l.id ${joins} WHERE m.level_id = $1::uuid ${order}`, [ref.levelId]
    )) as { id: string }[];
    return rows.map((r) => r.id);
  }
  return [];
}

async function scopeTitle(scopeKind: ScopeKind, ref: ScopeRef): Promise<string> {
  if (!sql) return "Untitled";
  const lookup: Partial<Record<ScopeKind, { table: string; id?: string }>> = {
    curriculum_level: { table: "curriculum_levels", id: ref.levelId },
    curriculum_module: { table: "curriculum_modules", id: ref.moduleId },
    curriculum_submodule: { table: "curriculum_submodules", id: ref.submoduleId },
    curriculum_lesson: { table: "curriculum_lessons", id: ref.lessonId },
  };
  const entry = lookup[scopeKind];
  if (entry?.id) {
    const rows = (await sql.query(
      `SELECT COALESCE(title, name, code) AS title FROM ${entry.table} WHERE id = $1::uuid`, [entry.id]
    )) as { title: string }[];
    if (rows[0]?.title) return rows[0].title;
  }
  if (scopeKind === "content_batch") {
    const level = ref.jlptLevel ? `${ref.jlptLevel} ` : "";
    return `${level}${ref.contentType ?? "content"}`.trim();
  }
  return "Untitled";
}

/**
 * The single entry point. Throws (rather than returning an empty snapshot) when a scope
 * resolves to nothing, so the admin gets "no published vocabulary matched those filters"
 * instead of a silently empty video.
 */
export async function resolveScope(scopeKind: ScopeKind, ref: ScopeRef): Promise<ContentSnapshot> {
  if (!sql) throw new Error("Database unavailable");

  let items: ContentItem[] = [];
  let title = await scopeTitle(scopeKind, ref);

  if (scopeKind === "content_item") {
    if (!ref.postId) throw new Error("content_item scope requires a postId");
    const typeRows = (await sql.query(`SELECT content_type, title FROM posts WHERE id = $1::uuid`, [ref.postId])) as {
      content_type: string;
      title: string;
    }[];
    if (!typeRows[0]) throw new Error("Post not found");
    const contentType = typeRows[0].content_type;
    title = typeRows[0].title;
    const rows = await queryPosts({ contentType, postIds: [ref.postId] });
    // A single item is worth the extra block query; a 200-item batch is not.
    items = await toContentItems(rows, contentType, true);
  } else if (scopeKind === "content_batch") {
    const contentType = ref.contentType;
    if (!contentType) throw new Error("content_batch scope requires a contentType");
    const rows = await queryPosts({
      contentType,
      jlptLevel: ref.jlptLevel,
      tags: ref.tags,
      limit: ref.limit ?? 10,
      postIds: ref.postIds,
    });
    items = await toContentItems(rows, contentType, false);
  } else {
    items = await resolveLessonItems(await lessonIdsUnder(scopeKind, ref));
  }

  if (items.length === 0) {
    throw new Error(
      scopeKind === "content_batch"
        ? `No published ${ref.contentType ?? "content"} matched those filters.`
        : "That scope contains no published content yet."
    );
  }

  return {
    scopeKind,
    scopeRef: ref,
    title,
    jlptLevel: ref.jlptLevel ?? items[0]?.jlptLevel,
    items,
  };
}

/** How many videos a project will produce, before any generation runs — the wizard shows this
 * so nobody accidentally queues 400 renders. */
export function plannedVideoCount(snapshot: ContentSnapshot, grouping: "single_video" | "video_per_item"): number {
  return grouping === "single_video" ? 1 : snapshot.items.length;
}
