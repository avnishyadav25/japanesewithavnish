import { sql } from "@/lib/db";
import type { LearnItemForFilter } from "@/lib/learn-filters";

/**
 * Curriculum-sequence-aware related grammar, in priority order:
 * 1. Next grammar point in the same curriculum submodule
 * 2/3. Other grammar in the same submodule (earlier items double as "prerequisite review")
 * 4. Same-JLPT-level grammar (fallback when curriculum position is unknown or the
 *    submodule is small)
 * 5. Any other published grammar (last-resort fallback)
 */
export async function getRelatedGrammar(
  postId: string,
  jlptLevel: string | null | undefined,
  currentSlug: string,
  limit = 6
): Promise<LearnItemForFilter[]> {
  if (!sql) return [];

  const results: LearnItemForFilter[] = [];
  const excludeSlugs = new Set<string>([currentSlug]);

  // A grammar point can be cross-linked into several curriculum lessons across unrelated
  // submodules (e.g. also referenced from a Reading or Listening lesson). Anchor on a
  // lesson whose own content_type is 'grammar' when one exists, so recommendations stay
  // topically relevant instead of landing in an arbitrary cross-linked module.
  const posRows = (await sql`
    SELECT cl.submodule_id, cl.sort_order AS lesson_sort_order, clg.sort_order AS item_sort_order
    FROM grammar g
    JOIN curriculum_lesson_grammar clg ON clg.grammar_id = g.id
    JOIN curriculum_lessons cl ON cl.id = clg.lesson_id
    WHERE g.post_id = ${postId}
    ORDER BY (cl.content_type = 'grammar') DESC, clg.sort_order ASC, cl.submodule_id ASC
    LIMIT 1
  `) as { submodule_id: string; lesson_sort_order: number; item_sort_order: number }[];

  const pos = posRows[0];

  if (pos) {
    const submoduleRows = (await sql`
      SELECT p.id, p.slug, p.title, p.content, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             p.tags, p.meta, p.status, p.sort_order, p.created_at, p.updated_at,
             cl.sort_order AS lesson_sort_order, clg.sort_order AS item_sort_order
      FROM curriculum_lessons cl
      JOIN curriculum_lesson_grammar clg ON clg.lesson_id = cl.id
      JOIN grammar g ON g.id = clg.grammar_id
      JOIN posts p ON p.id = g.post_id
      WHERE cl.submodule_id = ${pos.submodule_id} AND p.status = 'published' AND g.post_id != ${postId}
    `) as (LearnItemForFilter & { lesson_sort_order: number; item_sort_order: number })[];

    const currentKey = pos.lesson_sort_order * 100000 + pos.item_sort_order;
    const withKey = submoduleRows.map((r) => ({ ...r, _key: r.lesson_sort_order * 100000 + r.item_sort_order }));
    // Next lessons first (ascending), then prior lessons as "prerequisite review" (nearest first).
    const next = withKey.filter((r) => r._key > currentKey).sort((a, b) => a._key - b._key);
    const prior = withKey.filter((r) => r._key <= currentKey).sort((a, b) => b._key - a._key);

    for (const r of [...next, ...prior]) {
      if (results.length >= limit) break;
      if (excludeSlugs.has(r.slug)) continue;
      results.push(r);
      excludeSlugs.add(r.slug);
    }
  }

  if (results.length < limit && jlptLevel) {
    const sameLevelRows = (await sql`
      SELECT id, slug, title, content, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
      FROM posts
      WHERE content_type = 'grammar' AND status = 'published' AND slug != ALL(${Array.from(excludeSlugs)})
        AND (jlpt_level)[1] = ${jlptLevel}
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ${limit - results.length}
    `) as LearnItemForFilter[];
    for (const r of sameLevelRows) {
      results.push(r);
      excludeSlugs.add(r.slug);
    }
  }

  if (results.length < limit) {
    const fallbackRows = (await sql`
      SELECT id, slug, title, content, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
      FROM posts
      WHERE content_type = 'grammar' AND status = 'published' AND slug != ALL(${Array.from(excludeSlugs)})
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ${limit - results.length}
    `) as LearnItemForFilter[];
    results.push(...fallbackRows);
  }

  return results;
}
