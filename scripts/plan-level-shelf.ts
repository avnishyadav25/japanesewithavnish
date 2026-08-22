/**
 * Creates the whole set of projects for one JLPT level, from the format templates.
 *
 * WHY A SCRIPT. A level's shelf is ~100 projects across seven formats, each needing the right
 * template, item window and scope. Doing that by hand in the wizard is a hundred chances to pick
 * the wrong template, and the templates exist precisely so a series is the same shape every time.
 *
 * It does NOT generate scripts or render. Creating a project writes settings and nothing else, so
 * this is reversible; generation costs money and rendering costs hours. Review the list, then run
 * `npm run video:script -- --pending` and queue renders from the admin.
 *
 * Idempotent: a project whose title already exists is skipped, so a re-run tops up rather than
 * duplicating.
 *
 *   npx tsx scripts/plan-level-shelf.ts --level=N5 --dry-run
 *   npx tsx scripts/plan-level-shelf.ts --level=N5
 *   npx tsx scripts/plan-level-shelf.ts --level=N5 --only=vocabulary-drill-25
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const level = process.argv.find((a) => a.startsWith("--level="))?.slice(8) ?? "N5";
  const dryRun = process.argv.includes("--dry-run");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const { createProject } = await import("../src/lib/video/projects");
  const { VIDEO_TEMPLATES } = await import("../src/lib/video/templates");
  const { contentCoverage, videosFrom } = await import("../src/lib/video/coverage");

  const coverage = await contentCoverage();
  const existing = new Set(
    ((await sql`SELECT title FROM video_projects`) as { title: string }[]).map((r) => r.title)
  );

  const planned: { title: string; template: string; scopeRef: Record<string, unknown>; formats: string[] }[] = [];

  for (const t of Object.values(VIDEO_TEMPLATES)) {
    if (only && t.id !== only) continue;
    // Shorts scopes are the per-item firehose, not part of a level's long-form shelf. They are
    // created from the bulk-Shorts action, which already splits an item list.
    if (t.stylePreset === "shorts") continue;

    const row = coverage.rows.find((r) => r.contentType === t.contentType && r.level === level);
    if (!row || row.ready === 0) continue;

    const count = videosFrom(row.ready, t.itemsPerVideo);
    for (let part = 0; part < count; part += 1) {
      planned.push({
        title: `${level} ${t.contentType} — part ${part + 1} of ${count}`,
        template: t.id,
        scopeRef: {
          contentType: t.contentType,
          jlptLevel: level,
          limit: t.itemsPerVideo,
          // The window into the level's items. `offset` is honoured by the batch resolver so each
          // part covers different items rather than all of them covering the first N.
          offset: part * t.itemsPerVideo,
        },
        formats: ["landscape"],
      });
    }
  }

  // Kana is levelless and lives outside posts, so it is planned separately and only once.
  if (level === "N5" && (!only || only === "kana")) {
    const rows = (await sql`SELECT type, row_label FROM kana GROUP BY type, row_label ORDER BY type, MIN(sort_order)`) as {
      type: string;
      row_label: string;
    }[];
    for (const r of rows) {
      planned.push({
        title: `${r.type === "hiragana" ? "Hiragana" : "Katakana"} — ${r.row_label}-line`,
        template: "kana",
        scopeRef: { kanaType: r.type, kanaRow: r.row_label },
        formats: ["landscape"],
      });
    }
  }

  const todo = planned.filter((p) => !existing.has(p.title));
  console.log(`${planned.length} project(s) for ${level}; ${planned.length - todo.length} already exist, creating ${todo.length}${dryRun ? " (dry run)" : ""}\n`);

  const byTemplate = new Map<string, number>();
  for (const p of todo) byTemplate.set(p.template, (byTemplate.get(p.template) ?? 0) + 1);
  for (const [t, n] of Array.from(byTemplate)) console.log(`  ${t.padEnd(24)} ${n}`);

  if (dryRun || todo.length === 0) return;

  let made = 0;
  for (const p of todo) {
    try {
      await createProject({
        title: p.title,
        scopeKind: p.template === "kana" ? "kana_set" : "content_batch",
        scopeRef: p.scopeRef as never,
        grouping: "single_video",
        themeKey: "washi-light",
        bgmTrackId: null,
        narrationLangs: ["en"],
        formats: p.formats as never,
        templateId: p.template === "kana" ? null : p.template,
        itemCount: 99, // long-form by construction; never a Short
        createdBy: "plan-level-shelf",
      });
      made += 1;
    } catch (err) {
      console.log(`  FAILED ${p.title} — ${(err as Error).message.slice(0, 70)}`);
    }
  }

  console.log(`\n${made} project(s) created. Nothing generated and nothing rendered.`);
  console.log("Next: npm run video:script -- --pending   (scripts are cents; read a few before rendering)");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
