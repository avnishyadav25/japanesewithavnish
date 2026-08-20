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
import type { ContentItem, ContentSnapshot, ExampleSentence, ScopeKind, ScopeRef, VocabItem } from "./types";

/**
 * Sidecar table + the columns worth putting on screen, per content_type.
 *
 * Not every learn content type has one. `study_guide` and `conversation` are posts-only — their
 * substance lives in `posts.content` and `posts.meta` rather than a typed table. Those are
 * handled by omission here: `queryPosts` skips the JOIN entirely when a type is absent, rather
 * than the type being rejected. See LEARN_CONTENT_TYPES in src/lib/learn-filters.ts for the
 * full list the admin wizard offers.
 */
const SIDECARS: Record<string, { table: string; columns: string[]; exampleFk?: string }> = {
  vocabulary: {
    table: "vocabulary",
    columns: ["word", "reading", "meaning", "romaji", "part_of_speech", "transitivity", "notes"],
    exampleFk: "vocabulary_id",
  },
  grammar: {
    table: "grammar",
    // pattern_spoken / pattern_romaji are the curated speakable forms from migration 139,
    // populated by scripts/backfill-grammar-spoken.ts. They MUST be selected: 280 of 548
    // patterns are mixed notation like "Verb volitional form + と思います", and without the
    // curated column storyboard.ts silently falls back to crudely extracting Japanese runs —
    // which turns "Vて-form + ください" into "て、ください" instead of "ください", and cannot
    // express "this pattern should not be spoken at all" (an empty string).
    columns: ["pattern", "pattern_spoken", "pattern_romaji", "structure", "level", "meaning", "when_to_use", "notes"],
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

/**
 * Real vocabulary that contains a given kanji.
 *
 * Only 117 of 2,185 published kanji have example sentences of their own, so a kanji video built
 * purely from `examples` would be a stroke animation and two readings for 95% of the catalogue —
 * technically correct and not much use to a learner. Words that actually use the character are
 * the thing that makes a reading stick, and we already have 5,215 of them sitting in
 * `vocabulary`. One batched query covers a whole video's worth of kanji.
 */
async function fetchKanjiExampleWords(characters: string[]): Promise<Map<string, VocabItem[]>> {
  const byChar = new Map<string, VocabItem[]>();
  if (!sql || characters.length === 0) return byChar;

  for (const character of characters) {
    const rows = (await sql.query(
      `SELECT v.word, v.reading, v.romaji, v.meaning
       FROM vocabulary v
       JOIN posts p ON p.id = v.post_id
       WHERE p.status = 'published'
         AND v.word LIKE '%' || $1 || '%'
         AND v.meaning IS NOT NULL
         -- Entries like 〜本 are counter/suffix templates, not words. A voice reads the tilde
         -- aloud, and a learner cannot use one in a sentence.
         AND v.word !~ '[〜～~・（(]'
       ORDER BY
         -- A word with a stored reading is one the voice cannot mispronounce, because the kana
         -- goes into spokenAs. Prefer those over ones it would have to guess at.
         (v.reading IS NULL OR btrim(v.reading) = ''),
         -- Then shortest: 山 teaches better than 富士山麓鸚鵡.
         char_length(v.word),
         v.word
       LIMIT 3`,
      [character]
    )) as { word: string; reading: string | null; romaji: string | null; meaning: string }[];

    if (rows.length > 0) {
      byChar.set(
        character,
        rows.map((r) => ({
          word: r.word,
          reading: r.reading ?? undefined,
          romaji: r.romaji ?? undefined,
          meaning: r.meaning,
        }))
      );
    }
  }
  return byChar;
}

async function toContentItems(rows: PostRow[], contentType: string, includeBlocks: boolean): Promise<ContentItem[]> {
  const spec = SIDECARS[contentType];
  const sidecarIds = rows.map((r) => r.sidecar_id).filter((id): id is string => Boolean(id));
  const examplesBySidecar = await fetchSidecarExamples(contentType, sidecarIds);

  const exampleWordsByChar =
    contentType === "kanji"
      ? await fetchKanjiExampleWords(rows.map((r) => String(r.character ?? "")).filter(Boolean))
      : new Map<string, VocabItem[]>();

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

    const exampleWords = exampleWordsByChar.get(String(row.character ?? "")) ?? [];

    items.push({
      kind: contentType as ContentItem["kind"],
      postId: row.id,
      slug: row.slug,
      url: publicUrlFor(contentType, row.slug),
      title: row.title,
      summary: row.summary ?? undefined,
      jlptLevel: row.jlpt_level ?? undefined,
      data: { ...data, meta: row.meta ?? {}, ...(exampleWords.length > 0 ? { exampleWords } : {}) },
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
  // A type with no sidecar (study_guide, conversation) is queried straight off `posts` rather
  // than rejected — its content lives in posts.content/posts.meta, which the generic skeleton
  // and examplesFromMeta already know how to read.
  const spec: { table: string; columns: string[]; exampleFk?: string } | undefined = SIDECARS[params.contentType];

  const selectCols = spec
    ? `s.id AS sidecar_id, ${spec.columns.map((c) => `s.${c}`).join(", ")}`
    : `NULL::uuid AS sidecar_id`;
  const joinClause = spec ? `JOIN ${spec.table} s ON s.post_id = p.id` : "";

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
            ${selectCols}
     FROM posts p
     ${joinClause}
     WHERE ${where.join(" AND ")}
     ORDER BY p.sort_order, p.created_at
     ${limitClause}`,
    values
  )) as PostRow[];
}

async function resolveLessonItems(lessonIds: string[]): Promise<ContentItem[]> {
  if (!sql || lessonIds.length === 0) return [];
  const lessons = (await sql.query(
    // IDs, not just titles. A finished video has to be attachable to the lesson AND to the module
    // and submodule above it, and only the titles used to survive this query — so nothing
    // downstream could name the tier it belonged to. `curriculum_lessons` carries only
    // `submodule_id`, so the ids for the tiers above exist nowhere else without this join chain.
    `SELECT l.id, l.code, l.title, l.slug, l.goal, l.introduction, l.summary, l.content_type,
            l.estimated_minutes,
            sm.id AS submodule_id, sm.title AS submodule_title,
            m.id AS module_id, m.title AS module_title,
            lv.id AS level_id, lv.code AS level_code
     FROM curriculum_lessons l
     JOIN curriculum_submodules sm ON sm.id = l.submodule_id
     JOIN curriculum_modules m ON m.id = sm.module_id
     JOIN curriculum_levels lv ON lv.id = m.level_id
     WHERE l.id = ANY($1::uuid[])
     ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order`,
    [lessonIds]
  )) as Record<string, string | number | null>[];

  // One query for every lesson's objectives instead of one per lesson. A whole JLPT level is 50+
  // lessons, and this loop used to make two sequential round trips each — 100+ against Neon over
  // HTTP, which is enough to make the estimate feel broken.
  const objectiveRows = (await sql.query(
    `SELECT lesson_id, objective_text FROM learning_objectives
     WHERE lesson_id = ANY($1::uuid[]) ORDER BY lesson_id, sort_order`,
    [lessonIds]
  )) as { lesson_id: string; objective_text: string }[];

  const objectivesByLesson = new Map<string, string[]>();
  for (const row of objectiveRows) {
    const list = objectivesByLesson.get(row.lesson_id) ?? [];
    list.push(row.objective_text);
    objectivesByLesson.set(row.lesson_id, list);
  }

  // Blocks still cost one call per lesson — getResolvedLessonBlocks is shared with the public
  // lesson pages and already batches its FK lookups within a lesson, so it is not worth
  // restructuring for this. Running them a few at a time instead of strictly in series cuts the
  // wall-clock without flooding the connection.
  const CONCURRENCY = 6;
  const blocksByLesson = new Map<string, Awaited<ReturnType<typeof getResolvedLessonBlocks>>>();
  for (let i = 0; i < lessons.length; i += CONCURRENCY) {
    const slice = lessons.slice(i, i + CONCURRENCY);
    const resolved = await Promise.all(slice.map((l) => getResolvedLessonBlocks(String(l.id))));
    slice.forEach((l, n) => blocksByLesson.set(String(l.id), resolved[n]));
  }

  const childrenByLesson = await resolveLessonChildren(lessonIds);

  const items: ContentItem[] = [];
  for (const lesson of lessons) {
    const lessonId = String(lesson.id);
    const resolved = blocksByLesson.get(lessonId)!;
    const objectives = (objectivesByLesson.get(lessonId) ?? []).map((objective_text) => ({ objective_text }));

    items.push({
      children: childrenByLesson.get(lessonId) ?? [],
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
        moduleId: lesson.module_id,
        moduleTitle: lesson.module_title,
        submoduleId: lesson.submodule_id,
        submoduleTitle: lesson.submodule_title,
        levelId: lesson.level_id,
        objectives: objectives.map((o) => o.objective_text),
      },
      examples: [],
      blocks: resolved.blocks.map((b) => ({ blockType: b.blockType, data: { ...b.data, __resolved: b.resolved } })),
    });
  }
  return items;
}

/**
 * The vocabulary, kanji and grammar a lesson explicitly teaches.
 *
 * A curriculum lesson's own blocks are only `section_heading` and `rich_text` — there is no
 * filmable content inside the lesson itself. What it teaches lives in the join tables the
 * curriculum already maintains, and those are populated: 3,993 vocabulary links across 208
 * lessons, 2,185 kanji across 69, 375 grammar across 125.
 *
 * Using them keeps the video honest — these are the lesson's declared contents, not items
 * guessed from a topic match, so the video still teaches what the lesson page teaches.
 *
 * `curriculum_lesson_kana` / `_listening` / `_reading` / `_writing` / `_practice_test` exist but
 * are empty everywhere, so they are not queried.
 */
async function resolveLessonChildren(lessonIds: string[]): Promise<Map<string, ContentItem[]>> {
  const byLesson = new Map<string, ContentItem[]>();
  if (!sql || lessonIds.length === 0) return byLesson;

  const sources = [
    { join: "curriculum_lesson_vocabulary", fk: "vocabulary_id", sidecar: "vocabulary", kind: "vocabulary" },
    { join: "curriculum_lesson_kanji", fk: "kanji_id", sidecar: "kanji", kind: "kanji" },
    { join: "curriculum_lesson_grammar", fk: "grammar_id", sidecar: "grammar", kind: "grammar" },
  ] as const;

  for (const source of sources) {
    // One query per content type across every lesson, rather than per lesson.
    const links = (await sql.query(
      `SELECT j.lesson_id, s.post_id
       FROM ${source.join} j
       JOIN ${source.sidecar} s ON s.id = j.${source.fk}
       WHERE j.lesson_id = ANY($1::uuid[]) AND s.post_id IS NOT NULL
       ORDER BY j.lesson_id, j.sort_order`,
      [lessonIds]
    )) as { lesson_id: string; post_id: string }[];
    if (links.length === 0) continue;

    // Reuse the normal post pipeline so a child item is shaped exactly like one from a
    // content_batch scope — the scene builders then work on it unchanged.
    const rows = await queryPosts({ contentType: source.kind, postIds: links.map((l) => l.post_id) });
    const resolvedItems = await toContentItems(rows, source.kind, false);
    const byPost = new Map(resolvedItems.map((item) => [item.postId, item]));

    for (const link of links) {
      const item = byPost.get(link.post_id);
      if (!item) continue; // unpublished, or filtered out by queryPosts
      const list = byLesson.get(link.lesson_id) ?? [];
      list.push(item);
      byLesson.set(link.lesson_id, list);
    }
  }

  return byLesson;
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

  /**
   * The display column, per table.
   *
   * `curriculum_levels` calls it `name`; modules, submodules and lessons all call it `title`.
   * This was previously `COALESCE(title, name, code)`, which reads as "whichever one exists" and
   * is not that: Postgres resolves every column reference at PARSE time, before a value is
   * looked at, so the query needed all three columns present and failed on all four tables —
   * levels with `column "title" does not exist`, the rest with `column "name" does not exist`.
   * That made every curriculum scope unusable, including project creation, not just the
   * estimate. `code` exists everywhere and stays as the fallback.
   */
  const lookup: Partial<Record<ScopeKind, { table: string; titleColumn: string; id?: string }>> = {
    curriculum_level: { table: "curriculum_levels", titleColumn: "name", id: ref.levelId },
    curriculum_module: { table: "curriculum_modules", titleColumn: "title", id: ref.moduleId },
    curriculum_submodule: { table: "curriculum_submodules", titleColumn: "title", id: ref.submoduleId },
    curriculum_lesson: { table: "curriculum_lessons", titleColumn: "title", id: ref.lessonId },
  };
  const entry = lookup[scopeKind];
  if (entry?.id) {
    // Table and column both come from the hardcoded map above — no caller input reaches the SQL.
    const rows = (await sql.query(
      `SELECT COALESCE(${entry.titleColumn}, code) AS title FROM ${entry.table} WHERE id = $1::uuid`,
      [entry.id]
    )) as { title: string }[];
    if (rows[0]?.title) return rows[0].title;
  }
  if (scopeKind === "topic") {
    // The topic text is what the viewer hears in the intro, so it is used verbatim rather than
    // decorated with a level prefix.
    return ref.topic?.trim() || "Untitled topic";
  }
  if (scopeKind === "content_batch") {
    const level = ref.jlptLevel ? `${ref.jlptLevel} ` : "";
    return `${level}${ref.contentType ?? "content"}`.trim();
  }
  return "Untitled";
}

/**
 * Resolves a hand-confirmed topic basket.
 *
 * A topic spans content types — "greetings" is vocabulary *and* grammar — while `queryPosts`
 * takes exactly one. So group the ids by their post's type and run the existing per-type query
 * once per group, rather than growing a second sidecar-join implementation for mixed sets.
 *
 * The returned order follows `postIds`, which is the order shown in the picker. Falling back to
 * database order would silently reorder the video away from the list the admin approved.
 */
async function resolveTopicItems(postIds: string[]): Promise<ContentItem[]> {
  if (!sql || postIds.length === 0) return [];

  const rows = (await sql.query(
    `SELECT id, content_type FROM posts WHERE id = ANY($1::uuid[]) AND status = 'published'`,
    [postIds]
  )) as { id: string; content_type: string }[];

  const byType = new Map<string, string[]>();
  for (const row of rows) {
    const list = byType.get(row.content_type) ?? [];
    list.push(row.id);
    byType.set(row.content_type, list);
  }

  const resolved = new Map<string, ContentItem>();
  // Array.from, not the Map directly: this tsconfig's target predates downlevelIteration.
  for (const [contentType, ids] of Array.from(byType)) {
    const posts = await queryPosts({ contentType, postIds: ids });
    for (const item of await toContentItems(posts, contentType, false)) {
      if (item.postId) resolved.set(item.postId, item);
    }
  }

  return postIds.map((id) => resolved.get(id)).filter((item): item is ContentItem => Boolean(item));
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
  } else if (scopeKind === "topic") {
    if (!ref.postIds?.length) throw new Error("topic scope requires at least one selected item");
    items = await resolveTopicItems(ref.postIds);
  } else {
    items = await resolveLessonItems(await lessonIdsUnder(scopeKind, ref));
  }

  if (items.length === 0) {
    throw new Error(
      scopeKind === "content_batch"
        ? `No published ${ref.contentType ?? "content"} matched those filters.`
        : scopeKind === "topic"
          ? "None of the selected items are published any more."
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
