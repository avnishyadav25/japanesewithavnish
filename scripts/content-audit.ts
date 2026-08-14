import "dotenv/config";
import { getContentAudit } from "../src/lib/admin/contentAudit";

function pct(current: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

async function main() {
  const audit = await getContentAudit();

  console.log("\nJLPT coverage targets");
  for (const row of audit.coverage) {
    console.log(
      [
        row.level,
        `kanji ${row.kanji}/${row.kanjiTarget} (${pct(row.kanji, row.kanjiTarget)}%)`,
        `vocab ${row.vocabulary}/${row.vocabularyTarget} (${pct(row.vocabulary, row.vocabularyTarget)}%)`,
        `grammar ${row.grammar}/${row.grammarTarget} (${pct(row.grammar, row.grammarTarget)}%)`,
      ].join(" | ")
    );
  }

  console.log("\nDuplicate groups");
  console.log(`vocabulary: ${audit.duplicateTotals.vocabulary} total (${audit.duplicates.vocabulary.length} shown)`);
  console.log(`grammar: ${audit.duplicateTotals.grammar} total (${audit.duplicates.grammar.length} shown)`);
  console.log(`kanji: ${audit.duplicateTotals.kanji} total (${audit.duplicates.kanji.length} shown)`);

  for (const type of ["vocabulary", "grammar", "kanji"] as const) {
    const groups = audit.duplicates[type].slice(0, 10);
    if (!groups.length) continue;
    console.log(`\nTop ${type} duplicates`);
    for (const group of groups) {
      console.log(`- ${group.key}: ${group.count} rows`);
    }
  }

  console.log("\nLesson quality issues");
  console.log(`total flagged: ${audit.lessonIssues.length}`);
  for (const issue of audit.lessonIssues.slice(0, 20)) {
    console.log(`- ${issue.level} | ${issue.lessonTitle} | ${issue.issue} | ${issue.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
