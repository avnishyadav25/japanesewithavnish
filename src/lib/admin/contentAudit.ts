import { sql } from "@/lib/db";

export const JLPT_CONTENT_TARGETS = {
  N5: { kanji: 80, vocabulary: 800, grammar: 80 },
  N4: { kanji: 250, vocabulary: 1500, grammar: 100 },
  N3: { kanji: 620, vocabulary: 3750, grammar: 150 },
  N2: { kanji: 1000, vocabulary: 6000, grammar: 200 },
  N1: { kanji: 2136, vocabulary: 10000, grammar: 300 },
} as const;

export type JlptLevelCode = keyof typeof JLPT_CONTENT_TARGETS;

const JLPT_LEVEL_SEQUENCE = ["N5", "N4", "N3", "N2", "N1"] as const satisfies readonly JlptLevelCode[];

function cumulativeLevelsFor(level: JlptLevelCode): JlptLevelCode[] {
  const index = JLPT_LEVEL_SEQUENCE.indexOf(level);
  return JLPT_LEVEL_SEQUENCE.slice(0, index + 1);
}

export type CoverageRow = {
  level: JlptLevelCode;
  vocabulary: number;
  vocabularyTarget: number;
  grammar: number;
  grammarTarget: number;
  kanji: number;
  kanjiTarget: number;
};

export type DuplicateGroup = {
  key: string;
  count: number;
  ids: string[];
  labels: string[];
};

export type DuplicateTotals = {
  vocabulary: number;
  grammar: number;
  kanji: number;
};

export type LessonQualityIssue = {
  lessonId: string;
  level: string;
  moduleTitle: string;
  lessonTitle: string;
  issue: string;
  detail: string;
};

export async function getContentAudit() {
  if (!sql) throw new Error("Database unavailable");
  const db = sql;

  const levels = Object.keys(JLPT_CONTENT_TARGETS) as JlptLevelCode[];

  const coverage = await Promise.all(
    levels.map(async (level) => {
      const target = JLPT_CONTENT_TARGETS[level];
      const includedLevels = cumulativeLevelsFor(level);
      const vocabularyRows = await db`
        SELECT COUNT(DISTINCT v.id)::int AS c
        FROM vocabulary v
        LEFT JOIN posts p ON p.id = v.post_id
        WHERE v.jlpt_level = ANY(${includedLevels})
           OR EXISTS (
             SELECT 1
             FROM unnest(coalesce(p.jlpt_level, '{}'::text[])) AS post_level(level_code)
             WHERE post_level.level_code = ANY(${includedLevels})
           )
      `;
      const grammarRows = await db`
        SELECT COUNT(DISTINCT g.id)::int AS c
        FROM grammar g
        LEFT JOIN posts p ON p.id = g.post_id
        WHERE g.level = ANY(${includedLevels})
           OR EXISTS (
             SELECT 1
             FROM unnest(coalesce(p.jlpt_level, '{}'::text[])) AS post_level(level_code)
             WHERE post_level.level_code = ANY(${includedLevels})
           )
      `;
      const kanjiRows = await db`
        SELECT COUNT(DISTINCT k.id)::int AS c
        FROM kanji k
        LEFT JOIN posts p ON p.id = k.post_id
        WHERE k.jlpt_level = ANY(${includedLevels})
           OR EXISTS (
             SELECT 1
             FROM unnest(coalesce(p.jlpt_level, '{}'::text[])) AS post_level(level_code)
             WHERE post_level.level_code = ANY(${includedLevels})
           )
      `;
      return {
        level,
        vocabulary: vocabularyRows[0]?.c ?? 0,
        vocabularyTarget: target.vocabulary,
        grammar: grammarRows[0]?.c ?? 0,
        grammarTarget: target.grammar,
        kanji: kanjiRows[0]?.c ?? 0,
        kanjiTarget: target.kanji,
      } satisfies CoverageRow;
    })
  );

  const [
    vocabularyDuplicateTotalRows,
    grammarDuplicateTotalRows,
    kanjiDuplicateTotalRows,
    vocabularyDuplicates,
    grammarDuplicates,
    kanjiDuplicates,
    lessonIssues,
  ] = await Promise.all([
    db`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT lower(trim(word)) || '|' || coalesce(lower(trim(reading)), '') AS key
        FROM vocabulary
        WHERE word IS NOT NULL AND trim(word) <> ''
        GROUP BY 1
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    db`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT lower(trim(pattern)) AS key
        FROM grammar
        WHERE pattern IS NOT NULL AND trim(pattern) <> ''
        GROUP BY 1
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    db`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT character AS key
        FROM kanji
        WHERE character IS NOT NULL AND trim(character) <> ''
        GROUP BY 1
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    db`
      SELECT
        lower(trim(word)) || '|' || coalesce(lower(trim(reading)), '') AS key,
        COUNT(*)::int AS count,
        array_agg(id::text ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
        array_agg(coalesce(word, '') || coalesce(' (' || reading || ')', '') ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS labels
      FROM vocabulary
      WHERE word IS NOT NULL AND trim(word) <> ''
      GROUP BY 1
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, key
      LIMIT 50
    `,
    db`
      SELECT
        lower(trim(pattern)) AS key,
        COUNT(*)::int AS count,
        array_agg(id::text ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
        array_agg(coalesce(pattern, '') ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS labels
      FROM grammar
      WHERE pattern IS NOT NULL AND trim(pattern) <> ''
      GROUP BY 1
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, key
      LIMIT 50
    `,
    db`
      SELECT
        character AS key,
        COUNT(*)::int AS count,
        array_agg(id::text ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
        array_agg(coalesce(character, '') || coalesce(' - ' || meaning, '') ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS labels
      FROM kanji
      WHERE character IS NOT NULL AND trim(character) <> ''
      GROUP BY 1
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, key
      LIMIT 50
    `,
    db`
      WITH lesson_body AS (
        SELECT
          l.id,
          lv.code AS level,
          m.title AS module_title,
          l.title AS lesson_title,
          l.feature_image_url,
          coalesce(p.content, '') AS content,
          (SELECT COUNT(*) FROM curriculum_lesson_vocabulary clv WHERE clv.lesson_id = l.id) AS vocabulary_count,
          (SELECT COUNT(*) FROM curriculum_lesson_grammar clg WHERE clg.lesson_id = l.id) AS grammar_count,
          (SELECT COUNT(*) FROM curriculum_lesson_kanji clk WHERE clk.lesson_id = l.id) AS kanji_count,
          (SELECT COUNT(*) FROM grammar_drill_items gdi WHERE gdi.lesson_id = l.id) AS drill_count,
          (SELECT COUNT(*) FROM examples e WHERE e.lesson_id = l.id) AS example_count
        FROM curriculum_lessons l
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        JOIN curriculum_modules m ON m.id = sm.module_id
        JOIN curriculum_levels lv ON lv.id = m.level_id
        LEFT JOIN curriculum_lesson_content clc ON clc.lesson_id = l.id AND clc.content_role = 'main'
        LEFT JOIN posts p ON p.id = clc.post_id
      )
      SELECT
        id::text AS "lessonId",
        level,
        module_title AS "moduleTitle",
        lesson_title AS "lessonTitle",
        issue,
        detail
      FROM (
        SELECT id, level, module_title, lesson_title, 'short_body' AS issue, length(content)::text || ' chars' AS detail
        FROM lesson_body WHERE length(content) < 500
        UNION ALL
        SELECT id, level, module_title, lesson_title, 'weak_outline', 'Missing common flow headings'
        FROM lesson_body
        WHERE content !~* '(learning goal|concept|breakdown|common mistake|quick practice|summary|next step)'
        UNION ALL
        SELECT id, level, module_title, lesson_title, 'missing_examples', example_count::text || ' examples'
        FROM lesson_body WHERE example_count = 0
        UNION ALL
        SELECT id, level, module_title, lesson_title, 'missing_drills', drill_count::text || ' drills'
        FROM lesson_body WHERE drill_count = 0
        UNION ALL
        SELECT id, level, module_title, lesson_title, 'missing_links', 'vocab=' || vocabulary_count || ', grammar=' || grammar_count || ', kanji=' || kanji_count
        FROM lesson_body WHERE vocabulary_count = 0 AND grammar_count = 0 AND kanji_count = 0
        UNION ALL
        SELECT id, level, module_title, lesson_title, 'missing_feature_image', 'No feature image'
        FROM lesson_body WHERE feature_image_url IS NULL OR trim(feature_image_url) = ''
      ) issues
      ORDER BY level DESC, module_title, lesson_title, issue
      LIMIT 200
    `,
  ]);

  return {
    targets: JLPT_CONTENT_TARGETS,
    coverage,
    duplicateTotals: {
      vocabulary: vocabularyDuplicateTotalRows[0]?.count ?? 0,
      grammar: grammarDuplicateTotalRows[0]?.count ?? 0,
      kanji: kanjiDuplicateTotalRows[0]?.count ?? 0,
    } satisfies DuplicateTotals,
    duplicates: {
      vocabulary: vocabularyDuplicates as DuplicateGroup[],
      grammar: grammarDuplicates as DuplicateGroup[],
      kanji: kanjiDuplicates as DuplicateGroup[],
    },
    lessonIssues: lessonIssues as LessonQualityIssue[],
  };
}
