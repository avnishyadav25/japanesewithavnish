/**
 * Regenerates every Shorts project whose script was actually built as a lesson, and queues renders.
 *
 * WHY THESE EXIST. The admin's generate route never passed `stylePreset` or `decorAssets` into
 * `generateStoryboard` — they were added to the cost-estimate call beside it and, because of how
 * that edit was made, not to the real one. So the estimate was priced as a Short and the video was
 * built as a lesson: no beat split, a silent 2.5s mascot intro, no stickers, whole-line captions.
 * Every version of all nine projects.
 *
 * This does NOT reimplement generation. It calls the script worker's own path, which has always
 * passed the preset correctly, then enqueues renders. Sequential on purpose: renders run one at a
 * time anyway, and nine simultaneous dispatches would just queue nine jobs at once with no way to
 * stop after looking at the first.
 *
 *   npx tsx scripts/fix-shorts-projects.ts --dry-run    list what would change
 *   npx tsx scripts/fix-shorts-projects.ts              regenerate scripts only
 *   npx tsx scripts/fix-shorts-projects.ts --render     regenerate and queue renders
 *   npx tsx scripts/fix-shorts-projects.ts --limit=1    do one, to check the shape first
 */
import { config as loadEnv } from "dotenv";
import { spawnSync } from "child_process";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const render = process.argv.includes("--render");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.slice(8);
  const limit = limitArg ? Number(limitArg) : null;

  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const { getProject, enqueueRenderJobs } = await import("../src/lib/video/projects");

  const rows = (await sql`
    SELECT p.id, p.title, s.version, s.doc->>'stylePreset' AS doc_preset
    FROM video_projects p
    LEFT JOIN video_storyboards s ON s.id = p.current_storyboard_id
    WHERE p.style_preset = 'shorts'
      AND (s.id IS NULL OR s.doc->>'stylePreset' IS DISTINCT FROM 'shorts')
    ORDER BY p.created_at
  `) as { id: string; title: string; version: number | null; doc_preset: string | null }[];

  const todo = limit ? rows.slice(0, limit) : rows;
  console.log(`${rows.length} Shorts project(s) with a lesson-shaped script; doing ${todo.length}${dryRun ? " (dry run)" : ""}\n`);
  if (todo.length === 0) return;

  let fixed = 0;
  let queued = 0;
  const failures: string[] = [];

  for (let i = 0; i < todo.length; i += 1) {
    const row = todo[i];
    const label = `${String(i + 1).padStart(2)}/${todo.length}  ${row.title.slice(0, 46).padEnd(48)}`;
    if (dryRun) {
      console.log(`${label} v${row.version ?? "-"} preset=${row.doc_preset ?? "none"} -> would regenerate`);
      continue;
    }

    // The worker, not a copy of it. It reads the project, resolves the scope, passes the preset and
    // the sticker library, and inserts a version — all code that is already exercised.
    const out = spawnSync("npx", ["tsx", "scripts/video-script-worker.ts", `--project=${row.id}`], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (out.status !== 0) {
      console.log(`${label} FAILED\n${(out.stderr || out.stdout || "").trim().split("\n").slice(-3).join("\n")}`);
      failures.push(row.title);
      continue;
    }

    const after = (await sql`
      SELECT s.version, s.doc->>'stylePreset' AS preset,
             jsonb_array_length(s.doc->'scenes')::int AS scenes,
             (SELECT COUNT(*)::int FROM jsonb_array_elements(s.doc->'scenes') e WHERE e ? 'decor') AS decor
      FROM video_projects p JOIN video_storyboards s ON s.id = p.current_storyboard_id
      WHERE p.id = ${row.id}::uuid
    `) as { version: number; preset: string; scenes: number; decor: number }[];
    const a = after[0];

    if (a?.preset !== "shorts") {
      // Do not report success on a project that is still wrong — that is how the original bug
      // survived a green test run.
      console.log(`${label} STILL LESSON after regenerating — not fixed`);
      failures.push(row.title);
      continue;
    }
    fixed += 1;

    let q = 0;
    if (render) {
      const project = await getProject(row.id);
      if (project?.currentStoryboardId) {
        const res = await enqueueRenderJobs({
          projectId: row.id,
          storyboardId: project.currentStoryboardId,
          formats: project.formats,
          requestedBy: "fix-shorts-projects",
        });
        q = res.queued.length;
        queued += q;
      }
    }
    console.log(`${label} v${a.version} shorts · ${a.scenes} scenes · ${a.decor} sticker(s)${render ? ` · ${q} render(s) queued` : ""}`);
  }

  if (dryRun) return;
  console.log(`\n${fixed} regenerated as Shorts, ${failures.length} still wrong.`);
  if (failures.length > 0) console.log(`Not fixed: ${failures.join(", ")}`);
  if (render) {
    console.log(`${queued} render(s) queued. They run one at a time; watch /admin/video/jobs.`);
  } else {
    console.log("No renders queued — re-run with --render, or queue them from the project pages.");
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
