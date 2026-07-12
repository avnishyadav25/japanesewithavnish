import "dotenv/config";
import { sql } from "../src/lib/db";

/**
 * P0-4/5/6: Severity-triage report for Vocabulary/Grammar/Kanji data quality.
 * Read-only — flags the worst offenders (per the audit) for manual review. Does not edit
 * anything. Run this periodically as content grows; fix flagged rows through the admin
 * editor (now that the sync bug is fixed, edits take effect immediately).
 *
 * Usage: npx tsx scripts/triage-content-quality.ts
 */

const HIRAGANA_ONLY = /^[ぁ-ゖゝ-ゟー]+$/;

async function main() {
  if (!sql) throw new Error("Database not configured");

  console.log("=".repeat(70));
  console.log("VOCABULARY triage");
  console.log("=".repeat(70));

  const vocabRows = (await sql`
    SELECT v.id, v.word, v.reading, v.meaning, v.notes, p.status
    FROM vocabulary v JOIN posts p ON p.id = v.post_id
  `) as { id: string; word: string; reading: string | null; meaning: string | null; notes: string | null; status: string }[];

  const hiraganaOnly = vocabRows.filter((v) => v.word && HIRAGANA_ONLY.test(v.word) && v.word === v.reading);
  console.log(`\nHiragana-only word===reading (possible mis-imported entries): ${hiraganaOnly.length}`);
  hiraganaOnly.slice(0, 15).forEach((v) => console.log(`  ${v.word} — "${v.meaning}" (${v.status})`));

  const grammarLikeWords = vocabRows.filter((v) => v.word && (v.word.includes("〜") || v.word.includes("～")));
  console.log(`\nVocabulary rows that look like grammar patterns (contain 〜): ${grammarLikeWords.length}`);
  grammarLikeWords.slice(0, 15).forEach((v) => console.log(`  ${v.word} — "${v.meaning}" (${v.status})`));

  const exposedNotes = vocabRows.filter(
    (v) => v.notes && /imported from|coverage list|draft for|todo|fixme/i.test(v.notes)
  );
  console.log(`\nRows with internal/editorial notes exposed publicly: ${exposedNotes.length}`);
  exposedNotes.slice(0, 15).forEach((v) => console.log(`  ${v.word} — notes: "${v.notes}" (${v.status})`));

  const blankTitles = vocabRows.filter((v) => !v.word || !v.word.trim());
  console.log(`\nBlank/missing word: ${blankTitles.length}`);

  console.log("\n" + "=".repeat(70));
  console.log("GRAMMAR triage");
  console.log("=".repeat(70));

  const grammarRows = (await sql`
    SELECT g.id, g.pattern, g.structure, g.level, p.status
    FROM grammar g JOIN posts p ON p.id = g.post_id
    ORDER BY g.pattern
  `) as { id: string; pattern: string; structure: string | null; level: string | null; status: string }[];

  // Cheap near-duplicate heuristic: normalize by stripping particles/punctuation/whitespace and compare.
  function normalizePattern(p: string): string {
    return p
      .replace(/[〜～\s]/g, "")
      .replace(/です|だ|である/g, "")
      .toLowerCase();
  }
  const byNormalized = new Map<string, typeof grammarRows>();
  for (const g of grammarRows) {
    const key = normalizePattern(g.pattern || "");
    if (!key) continue;
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key)!.push(g);
  }
  const dupGroups = Array.from(byNormalized.entries()).filter(([, rows]) => rows.length > 1);
  console.log(`\nPossible duplicate/overlapping grammar patterns: ${dupGroups.length} group(s)`);
  dupGroups.slice(0, 15).forEach(([key, rows]) => {
    console.log(`  Group "${key}":`);
    rows.forEach((r) => console.log(`    - ${r.pattern} (${r.level}, ${r.status})`));
  });

  const genericStructure = grammarRows.filter(
    (g) => g.structure && /focus on connection pattern|generic|placeholder|todo/i.test(g.structure)
  );
  console.log(`\nGrammar rows with generic/boilerplate structure text: ${genericStructure.length}`);
  genericStructure.slice(0, 15).forEach((g) => console.log(`  ${g.pattern} — "${g.structure}"`));

  console.log("\n" + "=".repeat(70));
  console.log("KANJI triage");
  console.log("=".repeat(70));

  const kanjiRows = (await sql`
    SELECT k.id, k.character, k.meaning, p.status, p.jlpt_level
    FROM kanji k JOIN posts p ON p.id = k.post_id
  `) as { id: string; character: string; meaning: string | null; status: string; jlpt_level: string[] | null }[];

  const multiChar = kanjiRows.filter((k) => k.character && Array.from(k.character).length > 1);
  console.log(`\nMulti-character values in kanji.character (should be vocabulary, not kanji): ${multiChar.length}`);
  multiChar.slice(0, 15).forEach((k) => console.log(`  ${k.character} — "${k.meaning}" (${k.status})`));

  const rareMeaningPatterns = kanjiRows.filter(
    (k) =>
      k.meaning &&
      /radical \(no\.|zodiac|\d+(AM|PM)-\d+(AM|PM)|Turkey|Spain|Iran|Vietnam|Persia/i.test(k.meaning)
  );
  console.log(`\nKanji with non-learner-relevant meanings (radical/zodiac/country/time-period): ${rareMeaningPatterns.length}`);
  rareMeaningPatterns.slice(0, 20).forEach((k) => console.log(`  ${k.character} (${k.status}) — "${k.meaning}"`));

  console.log("\n" + "=".repeat(70));
  console.log(
    `SUMMARY: vocab=${vocabRows.length} (${hiraganaOnly.length} hiragana-only, ${grammarLikeWords.length} grammar-like, ${exposedNotes.length} exposed-notes) | ` +
      `grammar=${grammarRows.length} (${dupGroups.length} dup groups, ${genericStructure.length} boilerplate) | ` +
      `kanji=${kanjiRows.length} (${multiChar.length} multi-char, ${rareMeaningPatterns.length} rare-meaning)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
