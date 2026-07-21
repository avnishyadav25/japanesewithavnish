import { sql } from "@/lib/db";
import type { BlockType, BlockDataMap } from "@/lib/blocks/blockTypes";
import { canViewBlock, highestTier, type BlockAccessTier, type ViewerAccessContext } from "@/lib/auth/blockAccess";

export type VocabResolved = { id: string; word: string; reading: string | null; meaning: string | null; slug: string };
export type GrammarResolved = { id: string; pattern: string; structure: string | null; level: string | null; slug: string };
export type KanjiResolved = { id: string; character: string; meaning: string | null; onyomi: string[] | null; kunyomi: string[] | null; slug: string };
export type KanaResolved = { id: string; character: string; romaji: string; rowLabel: string | null; type: string };
export type ExampleResolved = { id: string; sentenceJa: string; sentenceRomaji: string | null; sentenceEn: string; notes: string | null };
export type LessonResolved = { id: string; title: string; code: string; slug: string | null };

/** A lesson_blocks row with its referenced content (vocab/grammar/kanji/kana/examples) resolved,
 * so renderer components stay pure-presentational and don't need their own DB access. */
export interface ResolvedBlock<T extends BlockType = BlockType> {
  id: string;
  blockType: T;
  sortOrder: number;
  data: BlockDataMap[T];
  resolved: {
    vocabulary?: VocabResolved[];
    grammar?: GrammarResolved[];
    kanji?: KanjiResolved[];
    kana?: KanaResolved[];
    examples?: ExampleResolved[];
    lessons?: LessonResolved[];
  };
}

/** Describes gated content past the last block a viewer can see — a count and the tier that
 * would unlock it, never the gated content itself. See src/lib/auth/blockAccess.ts. */
export interface LockedAfter {
  count: number;
  requiredAccess: BlockAccessTier;
}

export interface ResolvedBlocksResult {
  blocks: ResolvedBlock[];
  lockedAfter: LockedAfter | null;
}

/** viewer omitted (or undefined) means "no gating applied" — every published block is visible,
 * identical to pre-Phase-2 behavior. Passing a viewer activates per-block filtering; a block a
 * viewer can't see is excluded from the returned array before any FK resolution happens, so its
 * data is never fetched-for-return, let alone serialized to the client. */
export async function getResolvedLessonBlocks(lessonId: string, viewer?: ViewerAccessContext): Promise<ResolvedBlocksResult> {
  if (!sql) return { blocks: [], lockedAfter: null };

  const allRows = (await sql`
    SELECT id, block_type, block_data, sort_order, block_access
    FROM lesson_blocks
    WHERE lesson_id = ${lessonId}::uuid AND status = 'published'
    ORDER BY sort_order, created_at
  `) as { id: string; block_type: BlockType; block_data: Record<string, unknown>; sort_order: number; block_access: BlockAccessTier }[];

  if (allRows.length === 0) return { blocks: [], lockedAfter: null };

  const blockRows = viewer ? allRows.filter((r) => canViewBlock(r.block_access, viewer)) : allRows;
  const lockedRows = viewer ? allRows.filter((r) => !canViewBlock(r.block_access, viewer)) : [];
  const lockedAfter: LockedAfter | null =
    lockedRows.length > 0 ? { count: lockedRows.length, requiredAccess: highestTier(lockedRows.map((r) => r.block_access)) } : null;

  if (blockRows.length === 0) return { blocks: [], lockedAfter };

  // Collect every referenced ID across all VISIBLE blocks so each content type is fetched in
  // one batch query — locked blocks' references are never fetched at all.
  const vocabIds = new Set<string>();
  const grammarIds = new Set<string>();
  const kanjiIds = new Set<string>();
  const kanaIds = new Set<string>();
  const exampleIds = new Set<string>();
  const lessonIds = new Set<string>();

  for (const b of blockRows) {
    const d = b.block_data || {};
    (d.vocabularyIds as string[] | undefined)?.forEach((id) => vocabIds.add(id));
    (d.grammarIds as string[] | undefined)?.forEach((id) => grammarIds.add(id));
    (d.kanjiIds as string[] | undefined)?.forEach((id) => kanjiIds.add(id));
    (d.kanaIds as string[] | undefined)?.forEach((id) => kanaIds.add(id));
    (d.exampleIds as string[] | undefined)?.forEach((id) => exampleIds.add(id));
    if (d.lessonId) lessonIds.add(d.lessonId as string);
  }

  const [vocabRows, grammarRows, kanjiRows, kanaRows, exampleRows, lessonRows] = await Promise.all([
    vocabIds.size
      ? sql`SELECT v.id, v.word, v.reading, v.meaning, p.slug FROM vocabulary v JOIN posts p ON p.id = v.post_id WHERE v.id = ANY(${Array.from(vocabIds)}::uuid[])`
      : Promise.resolve([]),
    grammarIds.size
      ? sql`SELECT g.id, g.pattern, g.structure, g.level, p.slug FROM grammar g JOIN posts p ON p.id = g.post_id WHERE g.id = ANY(${Array.from(grammarIds)}::uuid[])`
      : Promise.resolve([]),
    kanjiIds.size
      ? sql`SELECT k.id, k.character, k.meaning, k.onyomi, k.kunyomi, p.slug FROM kanji k JOIN posts p ON p.id = k.post_id WHERE k.id = ANY(${Array.from(kanjiIds)}::uuid[])`
      : Promise.resolve([]),
    kanaIds.size
      ? sql`SELECT id, character, romaji, row_label AS "rowLabel", type FROM kana WHERE id = ANY(${Array.from(kanaIds)}::uuid[])`
      : Promise.resolve([]),
    exampleIds.size
      ? sql`SELECT id, sentence_ja AS "sentenceJa", sentence_romaji AS "sentenceRomaji", sentence_en AS "sentenceEn", notes FROM examples WHERE id = ANY(${Array.from(exampleIds)}::uuid[])`
      : Promise.resolve([]),
    lessonIds.size
      ? sql`SELECT id, title, code, slug FROM curriculum_lessons WHERE id = ANY(${Array.from(lessonIds)}::uuid[])`
      : Promise.resolve([]),
  ]) as [VocabResolved[], GrammarResolved[], KanjiResolved[], KanaResolved[], ExampleResolved[], LessonResolved[]];

  const vocabById = new Map(vocabRows.map((v) => [v.id, v]));
  const grammarById = new Map(grammarRows.map((g) => [g.id, g]));
  const kanjiById = new Map(kanjiRows.map((k) => [k.id, k]));
  const kanaById = new Map(kanaRows.map((k) => [k.id, k]));
  const exampleById = new Map(exampleRows.map((e) => [e.id, e]));
  const lessonById = new Map(lessonRows.map((l) => [l.id, l]));

  const blocks = blockRows.map((b) => {
    const d = b.block_data || {};
    const resolved: ResolvedBlock["resolved"] = {};
    if (d.vocabularyIds) resolved.vocabulary = (d.vocabularyIds as string[]).map((id) => vocabById.get(id)).filter(Boolean) as VocabResolved[];
    if (d.grammarIds) resolved.grammar = (d.grammarIds as string[]).map((id) => grammarById.get(id)).filter(Boolean) as GrammarResolved[];
    if (d.kanjiIds) resolved.kanji = (d.kanjiIds as string[]).map((id) => kanjiById.get(id)).filter(Boolean) as KanjiResolved[];
    if (d.kanaIds) resolved.kana = (d.kanaIds as string[]).map((id) => kanaById.get(id)).filter(Boolean) as KanaResolved[];
    if (d.exampleIds) resolved.examples = (d.exampleIds as string[]).map((id) => exampleById.get(id)).filter(Boolean) as ExampleResolved[];
    if (d.lessonId) resolved.lessons = [lessonById.get(d.lessonId as string)].filter(Boolean) as LessonResolved[];

    return {
      id: b.id,
      blockType: b.block_type,
      sortOrder: b.sort_order,
      data: d as BlockDataMap[BlockType],
      resolved,
    };
  });

  return { blocks, lockedAfter };
}
