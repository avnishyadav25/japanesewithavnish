/**
 * Content Review Center regression test.
 *
 * Creates its own throwaway fixture posts (never touches real content), exercises the core
 * behaviors from the platform build + the 27-phase gap-fix sprint against a live dev server +
 * live DB, then deletes every fixture row it created — pass or fail.
 *
 * Requires: dev server running (npm run dev) against a genuinely clean .next build (running
 * `npm run build` against the same .next dir while `next dev` is live corrupts its cache —
 * restart `npm run dev` if you've done that), DATABASE_URL + ACCESS_TOKEN_SECRET in
 * .env.local, DEEPSEEK_API_KEY set (agents return empty findings without it, failing a few
 * checks). CRON_SECRET, if set, is used to drain any pre-existing job backlog first — the
 * single-item review route processes the queue's globally oldest job, not necessarily the
 * one just created, so leftover jobs (real content edits, scheduled re-review — cron only
 * runs in production, not locally) would otherwise steal this script's own checks.
 *
 * Cost: triggers ~2 real review runs against DeepSeek (a handful of cents' worth of tokens at
 * most, based on live runs this session costing ~$0.001-0.002 each).
 *
 * NOT covered here (see docs/content-review-center.md §10 "Phase 23" for how these were
 * verified instead): rate-limit and cost-cap, which need seeding a larger amount of synthetic
 * history to trigger — heavier to run on every invocation than the checks below justify; and
 * the learner-report-resolution email, which sends a real message via whatever SMTP is
 * configured — not something a repeatable script should trigger by default.
 *
 * Run: npm run test:content-review  (or: node test/content-review-regression.mjs)
 * Env: CR_BASE_URL to point at a non-default dev server (default http://localhost:3000)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { SignJWT } from "jose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.CR_BASE_URL || "http://localhost:3000";

function loadEnvLocal() {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✅" : "❌"} ${name}${detail && !pass ? ` — ${detail}` : ""}`);
}

async function main() {
  const env = loadEnvLocal();
  if (!env.DATABASE_URL || !env.ACCESS_TOKEN_SECRET) {
    console.error("Missing DATABASE_URL or ACCESS_TOKEN_SECRET in .env.local");
    process.exitCode = 1;
    return;
  }
  const sql = neon(env.DATABASE_URL);

  const ping = await fetch(BASE_URL).catch(() => null);
  if (!ping) {
    console.error(`Dev server not reachable at ${BASE_URL} — run "npm run dev" first (or set CR_BASE_URL).`);
    process.exitCode = 1;
    return;
  }

  const secret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
  const token = await new SignJWT({ email: "learnjapanesewithavnish@gmail.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);
  const authHeaders = { "Content-Type": "application/json", Cookie: `auth_session=${token}` };

  // The single-item review route inline-drains the queue's globally OLDEST job, not
  // necessarily the one it just created (claimNextJob() is strict FIFO by created_at) — so
  // any pre-existing backlog (content_edit/bulk_sweep jobs from real usage, or scheduled
  // re-review, since cron only runs in production, not locally) would silently steal this
  // script's own review-pipeline checks. Drain it first via the cron worker route so this
  // script's fixture jobs are guaranteed to be next in line.
  const [{ c: backlogBefore }] = await sql`SELECT count(*)::int AS c FROM content_review_jobs WHERE status IN ('queued', 'claimed', 'running')`;
  if (backlogBefore > 0) {
    if (!env.CRON_SECRET) {
      console.warn(`⚠️  ${backlogBefore} job(s) already active in the queue and CRON_SECRET isn't set to drain them — this may cause the review-pipeline checks below to fail spuriously.\n`);
    } else {
      console.log(`Draining ${backlogBefore} pre-existing active job(s) before starting (avoids FIFO interference)...`);
      for (let tick = 0; tick < 10; tick++) {
        const drainRes = await fetch(`${BASE_URL}/api/cron/content-review-worker?key=${env.CRON_SECRET}`);
        const drainBody = await drainRes.json().catch(() => ({ processed: 0 }));
        if (!drainBody.processed) break;
      }
      const [{ c: backlogAfter }] = await sql`SELECT count(*)::int AS c FROM content_review_jobs WHERE status IN ('queued', 'claimed', 'running')`;
      console.log(`  ${backlogBefore - backlogAfter} drained, ${backlogAfter} remaining.\n`);
    }
  }

  const ts = Date.now();
  const slugA = `regr-test-grammar-${ts}`;
  const slugB = slugA.toUpperCase(); // case-flipped duplicate of slugA, for the Phase 27 check
  let postA, postB, postC, extraJobId, agentVersionId;

  console.log(`Content Review Center regression test — ${BASE_URL}\n`);

  try {
    console.log("Setting up fixture posts...");
    [postA] = await sql`
      INSERT INTO posts (content_type, slug, title, content, jlpt_level, tags, meta, status, sort_order)
      VALUES ('grammar', ${slugA}, 'Regression Test Grammar', '', '{N5}', '{}', '{}'::jsonb, 'draft', 9999)
      RETURNING id, slug, title, content, jlpt_level, tags, status, sort_order, meta
    `;
    await sql`
      INSERT INTO grammar (post_id, pattern, structure, level, notes)
      VALUES (${postA.id}, 'テスト', 'A real structure explanation used only for this regression test.', 'N5', null)
    `;
    // Note: postA deliberately has zero grammar_drill_items (tests Phase 24).

    [postB] = await sql`
      INSERT INTO posts (content_type, slug, title, content, jlpt_level, tags, meta, status, sort_order)
      VALUES ('grammar', ${slugB}, 'Regression Test Grammar (dup slug)', '', '{N5}', '{}', '{}'::jsonb, 'draft', 9999)
      RETURNING id
    `;

    [postC] = await sql`
      INSERT INTO posts (content_type, slug, title, content, jlpt_level, tags, meta, status, sort_order)
      VALUES ('listening', ${`regr-test-listening-${ts}`}, 'Regression Test Listening', '', '{N5}', '{}', '{}'::jsonb, 'draft', 9999)
      RETURNING id
    `;
    await sql`INSERT INTO listening (post_id, title, level, audio_url, notes) VALUES (${postC.id}, 'Regression Test Listening', 'N5', null, null)`;
    console.log(`  postA=${postA.id} postB=${postB.id} postC=${postC.id}\n`);

    // --- 1-6: full review pipeline (Phases 1, 7, 9, 12, 17, 24, 27) ---
    console.log("Running full review pipeline on postA...");
    const runRes = await fetch(`${BASE_URL}/api/admin/review/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "grammar", entityId: postA.id }),
    });
    const runBody = await runRes.json();
    check("Review job completes successfully", runRes.status === 200 && runBody.job?.status === "completed", JSON.stringify(runBody));

    const [run] = await sql`SELECT id, overall_status, category_scores, agent_keys_run, estimated_cost_usd FROM content_review_runs WHERE job_id = ${runBody.id}`;
    check("Run reaches overall_status='completed'", run?.overall_status === "completed");
    check("Cost tracking populated (estimated_cost_usd > 0)", Number(run?.estimated_cost_usd) > 0, String(run?.estimated_cost_usd));

    const nonAggregatorAgents = (run?.agent_keys_run ?? []).filter((a) => a !== "final_aggregator");
    const scoresCoverAllAgents = nonAggregatorAgents.every((a) => run?.category_scores && Object.prototype.hasOwnProperty.call(run.category_scores, a));
    check("category_scores has an entry for every agent that ran (Phase 7)", scoresCoverAllAgents, JSON.stringify(run?.category_scores));

    const findings = await sql`SELECT title, field_name, why_it_matters FROM content_review_findings WHERE review_run_id = ${run?.id}`;
    check("At least one finding has why_it_matters populated (Phase 17)", findings.some((f) => f.why_it_matters), `${findings.length} finding(s)`);
    check(
      "Zero-practice-items finding fires for a grammar post with no drill items (Phase 24)",
      findings.some((f) => f.title === "No practice drill items at all")
    );
    check(
      "Duplicate-slug finding fires against the case-flipped duplicate (Phase 27)",
      findings.some((f) => f.field_name === "slug")
    );

    // --- 7-8: skip-if-unchanged + force override (Phase 11) ---
    const skipRes = await fetch(`${BASE_URL}/api/admin/review/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "grammar", entityId: postA.id }),
    });
    const skipBody = await skipRes.json();
    check("Re-running unchanged content is skipped (Phase 11)", skipBody.skipped === true, JSON.stringify(skipBody));

    const forceRes = await fetch(`${BASE_URL}/api/admin/review/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "grammar", entityId: postA.id, force: true }),
    });
    const forceBody = await forceRes.json();
    check("force:true bypasses the skip (Phase 11)", forceBody.skipped !== true && !!forceBody.id, JSON.stringify(forceBody));

    // --- 9: event-driven re-review on edit (Phase 8) ---
    const beforeEditJobs = await sql`SELECT count(*)::int AS c FROM content_review_jobs WHERE entity_id = ${postA.id} AND trigger_type = 'content_edit'`;
    const editRes = await fetch(`${BASE_URL}/api/admin/learning-content/grammar/${slugA}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        slug: slugA,
        title: "Regression Test Grammar (edited)",
        content: postA.content,
        jlpt_level: "N5",
        tags: postA.tags,
        status: postA.status,
        sort_order: postA.sort_order,
        meta: postA.meta,
      }),
    });
    await editRes.json().catch(() => null);
    const afterEditJobs = await sql`SELECT count(*)::int AS c FROM content_review_jobs WHERE entity_id = ${postA.id} AND trigger_type = 'content_edit'`;
    check("Editing content auto-queues a content_edit re-review job (Phase 8)", afterEditJobs[0].c > beforeEditJobs[0].c);

    // --- 10: Agent Configuration save regression (the temperature-column bug, Phase 12) ---
    const [agentBefore] = await sql`SELECT is_enabled FROM content_review_agents WHERE agent_key = 'metadata_taxonomy'`;
    const [versionsBefore] = await sql`SELECT count(*)::int AS c FROM review_agent_versions WHERE agent_key = 'metadata_taxonomy'`;
    const agentPatchRes = await fetch(`${BASE_URL}/api/admin/review/agents/metadata_taxonomy`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ isEnabled: agentBefore.is_enabled }), // same value — a genuine no-op save
    });
    check("Agent Configuration save succeeds without a 500 (regression: temperature column)", agentPatchRes.status === 200, String(agentPatchRes.status));
    const [versionsAfter] = await sql`SELECT count(*)::int AS c FROM review_agent_versions WHERE agent_key = 'metadata_taxonomy'`;
    check("Agent Configuration save records a version history row (Phase 18)", versionsAfter.c > versionsBefore.c);
    if (versionsAfter.c > versionsBefore.c) {
      const [latest] = await sql`SELECT id FROM review_agent_versions WHERE agent_key = 'metadata_taxonomy' ORDER BY created_at DESC LIMIT 1`;
      agentVersionId = latest?.id;
    }

    // --- 11: job cancellation (Phase 23) ---
    const [insertedJob] = await sql`
      INSERT INTO content_review_jobs (entity_type, entity_id, trigger_type, status, requested_by)
      VALUES ('grammar', ${postB.id}, 'manual_single', 'queued', 'regression-test@local')
      RETURNING id
    `;
    extraJobId = insertedJob.id;
    const cancelRes = await fetch(`${BASE_URL}/api/admin/review/jobs/${extraJobId}/cancel`, { method: "POST", headers: authHeaders });
    const [cancelledJob] = await sql`SELECT status FROM content_review_jobs WHERE id = ${extraJobId}`;
    check("Cancelling a queued job sets status='cancelled' (Phase 23)", cancelRes.status === 200 && cancelledJob.status === "cancelled");

    // --- 12-13: URL validation on Apply Fix (Phase 25) ---
    const [fakeRun] = await sql`
      INSERT INTO content_review_runs (entity_type, entity_id, content_snapshot, content_checksum, overall_status)
      VALUES ('listening', ${postC.id}, '{}'::jsonb, ${`regression-test-checksum-${ts}`}, 'completed')
      RETURNING id
    `;
    const [fakeFinding] = await sql`
      INSERT INTO content_review_findings (review_run_id, agent_key, severity, category, field_name, suggested_value, title, description)
      VALUES (${fakeRun.id}, 'listening_reviewer', 'major', 'practice_quality', 'audio_url', ${'"not-a-url"'}::jsonb, 'Regression test finding', 'test')
      RETURNING id
    `;
    const badUrlRes = await fetch(`${BASE_URL}/api/admin/review/findings/${fakeFinding.id}/apply-fix`, { method: "POST", headers: authHeaders, body: "{}" });
    check("Apply Fix rejects a non-URL value for audio_url (Phase 25)", badUrlRes.status === 400);

    const goodUrlRes = await fetch(`${BASE_URL}/api/admin/review/findings/${fakeFinding.id}/apply-fix`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ editedValue: "https://example.com/regression-test-audio.mp3" }),
    });
    check("Apply Fix accepts a valid URL for audio_url (Phase 25)", goodUrlRes.status === 200);
  } catch (err) {
    console.error("\nUnexpected error during test run:", err);
    results.push({ name: "run", pass: false, detail: err.message });
  } finally {
    console.log("\nCleaning up fixtures...");
    if (extraJobId) await sql`DELETE FROM content_review_jobs WHERE id = ${extraJobId}`.catch(() => {});
    if (agentVersionId) await sql`DELETE FROM review_agent_versions WHERE id = ${agentVersionId}`.catch(() => {});
    // Deleting the fixture posts cascades to their jobs/runs/findings/decisions
    // (content_review_jobs.entity_id, content_review_runs.entity_id, and
    // content_review_findings.review_run_id are all ON DELETE CASCADE).
    if (postA) await sql`DELETE FROM posts WHERE id = ${postA.id}`.catch(() => {});
    if (postB) await sql`DELETE FROM posts WHERE id = ${postB.id}`.catch(() => {});
    if (postC) await sql`DELETE FROM posts WHERE id = ${postC.id}`.catch(() => {});
    console.log("  done.\n");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("\nFailed:");
    failed.forEach((r) => console.log(`  - ${r.name}${r.detail ? ` (${r.detail})` : ""}`));
    process.exitCode = 1;
  }
}

main();
