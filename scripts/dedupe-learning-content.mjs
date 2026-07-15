import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const type = args.get("type") || "all";
const limit = Number(args.get("limit") || "10");
const apply = args.get("apply") === "true";
const confirmed = args.get("confirm") === "MERGE_DUPLICATES";

if (!["all", "vocabulary", "grammar", "kanji"].includes(type)) {
  console.error("Invalid --type. Use all, vocabulary, grammar, or kanji.");
  process.exit(1);
}

if (apply && !confirmed) {
  console.error("Refusing to merge without --confirm=MERGE_DUPLICATES.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function duplicateGroups(kind) {
  if (kind === "vocabulary") {
    const { rows } = await client.query(
      `
        SELECT lower(trim(word)) AS word_key, coalesce(lower(trim(reading)), '') AS reading_key,
               array_agg(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
               array_agg(post_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS post_ids,
               count(*)::int AS count
        FROM vocabulary
        WHERE word IS NOT NULL AND trim(word) <> ''
        GROUP BY 1, 2
        HAVING count(*) > 1
        ORDER BY count(*) DESC, word_key, reading_key
        LIMIT $1
      `,
      [limit]
    );
    return rows;
  }
  if (kind === "grammar") {
    // Normalize wave dash (U+301C) vs fullwidth tilde (U+FF5E) and whitespace —
    // the same grammar point was seeded twice using different placeholder characters.
    const { rows } = await client.query(
      `
        SELECT lower(regexp_replace(regexp_replace(pattern, '[〜～]', '~', 'g'), '\\s+', '', 'g')) AS key,
               level,
               array_agg(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
               array_agg(post_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS post_ids,
               count(*)::int AS count
        FROM grammar
        WHERE pattern IS NOT NULL AND trim(pattern) <> ''
        GROUP BY 1, 2
        HAVING count(*) > 1
        ORDER BY count(*) DESC, key
        LIMIT $1
      `,
      [limit]
    );
    return rows;
  }
  const { rows } = await client.query(
    `
      SELECT character AS key,
             array_agg(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS ids,
             array_agg(post_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS post_ids,
             count(*)::int AS count
      FROM kanji
      WHERE character IS NOT NULL AND trim(character) <> ''
      GROUP BY 1
      HAVING count(*) > 1
      ORDER BY count(*) DESC, key
      LIMIT $1
    `,
    [limit]
  );
  return rows;
}

async function archiveDuplicatePosts(postIds, canonicalPostId) {
  if (!postIds.length) return;
  await client.query(
    `
      UPDATE posts
      SET status = 'draft',
          meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('merged_into_post_id', $1::uuid, 'archived_by', 'dedupe-learning-content'),
          updated_at = now()
      WHERE id = ANY($2::uuid[])
    `,
    [canonicalPostId, postIds]
  );
}

async function mergeVocabulary(group) {
  const [canonicalId, ...duplicateIds] = group.ids;
  const [canonicalPostId, ...duplicatePostIds] = group.post_ids;
  if (!duplicateIds.length) return;

  await client.query(
    `
      UPDATE examples
      SET vocabulary_id = $1, updated_at = now()
      WHERE vocabulary_id = ANY($2::uuid[])
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(
    `
      INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
      SELECT lesson_id, $1, min(sort_order)
      FROM curriculum_lesson_vocabulary
      WHERE vocabulary_id = ANY($2::uuid[])
      GROUP BY lesson_id
      ON CONFLICT (lesson_id, vocabulary_id) DO NOTHING
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM curriculum_lesson_vocabulary WHERE vocabulary_id = ANY($1::uuid[])`, [duplicateIds]);
  await client.query(
    `
      UPDATE vocabulary target
      SET meaning = coalesce(nullif(target.meaning, ''), source.meaning),
          notes = concat_ws(E'\\n\\n', nullif(target.notes, ''), nullif(source.notes, '')),
          updated_at = now()
      FROM (
        SELECT string_agg(DISTINCT nullif(meaning, ''), '; ') AS meaning,
               string_agg(DISTINCT nullif(notes, ''), E'\\n\\n') AS notes
        FROM vocabulary
        WHERE id = ANY($2::uuid[])
      ) source
      WHERE target.id = $1
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM vocabulary WHERE id = ANY($1::uuid[])`, [duplicateIds]);
  await archiveDuplicatePosts(duplicatePostIds.filter(Boolean), canonicalPostId);
}

async function mergeGrammar(group) {
  const [canonicalId, ...duplicateIds] = group.ids;
  const [canonicalPostId, ...duplicatePostIds] = group.post_ids;
  if (!duplicateIds.length) return;

  await client.query(`UPDATE examples SET grammar_id = $1, updated_at = now() WHERE grammar_id = ANY($2::uuid[])`, [canonicalId, duplicateIds]);
  await client.query(`UPDATE grammar_drill_items SET grammar_id = $1, updated_at = now() WHERE grammar_id = ANY($2::uuid[])`, [canonicalId, duplicateIds]);
  await client.query(
    `
      INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
      SELECT lesson_id, $1, min(sort_order)
      FROM curriculum_lesson_grammar
      WHERE grammar_id = ANY($2::uuid[])
      GROUP BY lesson_id
      ON CONFLICT (lesson_id, grammar_id) DO NOTHING
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM curriculum_lesson_grammar WHERE grammar_id = ANY($1::uuid[])`, [duplicateIds]);
  await client.query(
    `
      UPDATE grammar target
      SET structure = coalesce(nullif(target.structure, ''), source.structure),
          notes = concat_ws(E'\\n\\n', nullif(target.notes, ''), nullif(source.notes, '')),
          updated_at = now()
      FROM (
        SELECT string_agg(DISTINCT nullif(structure, ''), '; ') AS structure,
               string_agg(DISTINCT nullif(notes, ''), E'\\n\\n') AS notes
        FROM grammar
        WHERE id = ANY($2::uuid[])
      ) source
      WHERE target.id = $1
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM grammar WHERE id = ANY($1::uuid[])`, [duplicateIds]);
  await archiveDuplicatePosts(duplicatePostIds.filter(Boolean), canonicalPostId);
}

async function mergeKanji(group) {
  const [canonicalId, ...duplicateIds] = group.ids;
  const [canonicalPostId, ...duplicatePostIds] = group.post_ids;
  if (!duplicateIds.length) return;

  await client.query(
    `
      INSERT INTO curriculum_lesson_kanji (lesson_id, kanji_id, sort_order)
      SELECT lesson_id, $1, min(sort_order)
      FROM curriculum_lesson_kanji
      WHERE kanji_id = ANY($2::uuid[])
      GROUP BY lesson_id
      ON CONFLICT (lesson_id, kanji_id) DO NOTHING
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM curriculum_lesson_kanji WHERE kanji_id = ANY($1::uuid[])`, [duplicateIds]);
  await client.query(
    `
      UPDATE kanji target
      SET stroke_count = coalesce(target.stroke_count, source.stroke_count),
          meaning = coalesce(nullif(target.meaning, ''), source.meaning),
          notes = concat_ws(E'\\n\\n', nullif(target.notes, ''), nullif(source.notes, '')),
          updated_at = now()
      FROM (
        SELECT max(stroke_count) AS stroke_count,
               string_agg(DISTINCT nullif(meaning, ''), '; ') AS meaning,
               string_agg(DISTINCT nullif(notes, ''), E'\\n\\n') AS notes
        FROM kanji
        WHERE id = ANY($2::uuid[])
      ) source
      WHERE target.id = $1
    `,
    [canonicalId, duplicateIds]
  );
  await client.query(`DELETE FROM kanji WHERE id = ANY($1::uuid[])`, [duplicateIds]);
  await archiveDuplicatePosts(duplicatePostIds.filter(Boolean), canonicalPostId);
}

async function runKind(kind) {
  const groups = await duplicateGroups(kind);
  console.log(`\n${kind}: ${groups.length} duplicate groups${apply ? " to merge" : " (dry run)"}`);
  for (const group of groups) {
    console.log(`- ${group.key || `${group.word_key}|${group.reading_key}`}: keep ${group.ids[0]}, merge ${group.ids.slice(1).join(", ")}`);
    if (!apply) continue;
    await client.query("BEGIN");
    try {
      if (kind === "vocabulary") await mergeVocabulary(group);
      if (kind === "grammar") await mergeGrammar(group);
      if (kind === "kanji") await mergeKanji(group);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
}

await client.connect();
try {
  const kinds = type === "all" ? ["vocabulary", "grammar", "kanji"] : [type];
  for (const kind of kinds) await runKind(kind);
  if (!apply) {
    console.log("\nDry run only. Add --apply --confirm=MERGE_DUPLICATES to merge.");
  }
} finally {
  await client.end();
}
