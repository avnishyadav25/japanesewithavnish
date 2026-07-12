import { sql } from "@/lib/db";
import type { BlockType, BlockDataMap } from "@/lib/curriculum/blockTypes";

export type VocabResolved = { id: string; word: string; reading: string | null; meaning: string | null; slug: string };
export type GrammarResolved = { id: string; pattern: string; structure: string | null; level: string | null; slug: string };
export type KanjiResolved = { id: string; character: string; meaning: string | null; onyomi: string[] | null; kunyomi: string[] | null; slug: string };
export type KanaResolved = { id: string; character: string; romaji: string; rowLabel: string | null; type: string };
export type ExampleResolved = { id: string; sentenceJa: string; sentenceRomaji: string | null; sentenceEn: string; notes: string | null };

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
  };
}

export async function getResolvedLessonBlocks(lessonId: string): Promise<ResolvedBlock[]> {
  if (!sql) return [];

  const blockRows = (await sql`
    SELECT id, block_type, block_data, sort_order
    FROM lesson_blocks
    WHERE lesson_id = ${lessonId}::uuid AND status = 'published'
    ORDER BY sort_order, created_at
  `) as { id: string; block_type: BlockType; block_data: Record<string, unknown>; sort_order: number }[];

  if (blockRows.length === 0) return [];

  // Collect every referenced ID across all blocks so each content type is fetched in one batch query.
  const vocabIds = new Set<string>();
  const grammarIds = new Set<string>();
  const kanjiIds = new Set<string>();
  const kanaIds = new Set<string>();
  const exampleIds = new Set<string>();

  for (const b of blockRows) {
    const d = b.block_data || {};
    (d.vocabularyIds as string[] | undefined)?.forEach((id) => vocabIds.add(id));
    (d.grammarIds as string[] | undefined)?.forEach((id) => grammarIds.add(id));
    (d.kanjiIds as string[] | undefined)?.forEach((id) => kanjiIds.add(id));
    (d.kanaIds as string[] | undefined)?.forEach((id) => kanaIds.add(id));
    (d.exampleIds as string[] | undefined)?.forEach((id) => exampleIds.add(id));
  }

  const [vocabRows, grammarRows, kanjiRows, kanaRows, exampleRows] = await Promise.all([
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
  ]) as [VocabResolved[], GrammarResolved[], KanjiResolved[], KanaResolved[], ExampleResolved[]];

  const vocabById = new Map(vocabRows.map((v) => [v.id, v]));
  const grammarById = new Map(grammarRows.map((g) => [g.id, g]));
  const kanjiById = new Map(kanjiRows.map((k) => [k.id, k]));
  const kanaById = new Map(kanaRows.map((k) => [k.id, k]));
  const exampleById = new Map(exampleRows.map((e) => [e.id, e]));

  return blockRows.map((b) => {
    const d = b.block_data || {};
    const resolved: ResolvedBlock["resolved"] = {};
    if (d.vocabularyIds) resolved.vocabulary = (d.vocabularyIds as string[]).map((id) => vocabById.get(id)).filter(Boolean) as VocabResolved[];
    if (d.grammarIds) resolved.grammar = (d.grammarIds as string[]).map((id) => grammarById.get(id)).filter(Boolean) as GrammarResolved[];
    if (d.kanjiIds) resolved.kanji = (d.kanjiIds as string[]).map((id) => kanjiById.get(id)).filter(Boolean) as KanjiResolved[];
    if (d.kanaIds) resolved.kana = (d.kanaIds as string[]).map((id) => kanaById.get(id)).filter(Boolean) as KanaResolved[];
    if (d.exampleIds) resolved.examples = (d.exampleIds as string[]).map((id) => exampleById.get(id)).filter(Boolean) as ExampleResolved[];

    return {
      id: b.id,
      blockType: b.block_type,
      sortOrder: b.sort_order,
      data: d as BlockDataMap[BlockType],
      resolved,
    };
  });
}
