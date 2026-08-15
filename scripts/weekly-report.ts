import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { sendMail } from "../src/lib/email";
import { sql } from "../src/lib/db";
import { getDriverFor, otherProvider } from "../src/lib/db/drivers";
import { resolveActiveProvider } from "../src/lib/db/resolve-provider";

/**
 * Weekly infrastructure health report.
 *
 *   npm run report:weekly              # check + email + write report.md
 *   npm run report:weekly -- --dry-run # print, send nothing
 *
 * Exists because the failures this project has actually suffered were all SILENT: crons
 * declared in a file the platform never read (a month of dead backups), a standby 44 tables
 * behind, a queue re-claiming one poisoned job while 491 waited, a cost cap that could never
 * trip. Every check below is a thing that looked fine right up until someone went looking.
 *
 * Each check reports OK / WARN / FAIL independently and never throws — a report that dies on
 * its first failing check would hide the rest, which is the failure mode it exists to prevent.
 */

type Status = "OK" | "WARN" | "FAIL";
interface Check {
  name: string;
  status: Status;
  detail: string;
}

const checks: Check[] = [];
const add = (name: string, status: Status, detail: string) => checks.push({ name, status, detail });

async function checkReplication() {
  if (!sql) return add("Replication", "FAIL", "DATABASE_URL not set");
  try {
    // Query the STANDBY, not the primary. replication_poll_state is per-database and the
    // cursors are written to whichever side is receiving — so the primary's copy is stale
    // leftovers from whenever it last WAS the standby. The first version of this check read
    // the primary and reported "2 tables, oldest check 1210 min ago" while the standby was
    // healthily tracking 136. A monitoring check that reads the wrong database is worse than
    // none: it manufactures alarm and trains you to ignore it.
    const active = await resolveActiveProvider();
    const standby = getDriverFor(otherProvider(active));
    const rows = (await standby.query(`
      SELECT COUNT(*)::int AS tracked,
             COUNT(*) FILTER (WHERE last_error IS NOT NULL)::int AS errors,
             COALESCE(ROUND(EXTRACT(EPOCH FROM NOW() - MIN(last_synced_at)) / 60), 0)::int AS oldest_min
      FROM replication_poll_state WHERE last_synced_at IS NOT NULL
    `)) as { tracked: number; errors: number; oldest_min: number }[];
    const r = rows[0];
    if (!r || r.tracked === 0) return add("Replication", "FAIL", `no tracked tables on the ${otherProvider(active)} standby — replication has never run`);
    if (r.errors > 0) return add("Replication", "FAIL", `${r.errors} table(s) reporting errors, ${r.tracked} tracked`);
    if (r.oldest_min > 180) return add("Replication", "WARN", `${r.tracked} tables, oldest check ${r.oldest_min} min ago`);
    add("Replication", "OK", `${r.tracked} tables on the ${otherProvider(active)} standby, no errors, oldest check ${r.oldest_min} min ago`);
  } catch (e) {
    add("Replication", "FAIL", e instanceof Error ? e.message : "unknown error");
  }
}

async function checkBackupSync() {
  if (!sql) return;
  try {
    const rows = (await sql`SELECT status, run_completed_at, total_tables, tables_synced_failed FROM backup_sync_state WHERE id = 1`) as {
      status: string; run_completed_at: string | null; total_tables: number; tables_synced_failed: number;
    }[];
    const s = rows[0];
    if (!s?.run_completed_at) return add("Archive sync", "FAIL", "has never completed");
    const hours = Math.round((Date.now() - new Date(s.run_completed_at).getTime()) / 3_600_000);
    if (hours > 48) return add("Archive sync", "FAIL", `last completed ${hours}h ago — the hourly cron is not running`);
    if (s.tables_synced_failed > 0) return add("Archive sync", "WARN", `${s.tables_synced_failed} table(s) failed in the last run`);
    add("Archive sync", "OK", `completed ${hours}h ago, ${s.total_tables} tables`);
  } catch (e) {
    add("Archive sync", "FAIL", e instanceof Error ? e.message : "unknown error");
  }
}

async function checkReviewQueue() {
  if (!sql) return;
  try {
    const rows = (await sql`
      SELECT COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
             COUNT(*) FILTER (WHERE status IN ('claimed','running'))::int AS running,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
             COUNT(*) FILTER (WHERE attempt_count >= max_attempts AND status IN ('claimed','running'))::int AS stuck
      FROM content_review_jobs
    `) as { queued: number; running: number; failed: number; stuck: number }[];
    const q = rows[0];
    if (q.stuck > 0) return add("Review queue", "FAIL", `${q.stuck} job(s) past max_attempts still claimed — the queue is jammed`);
    if (q.queued > 200) return add("Review queue", "WARN", `${q.queued} queued, ${q.running} running, ${q.failed} failed`);
    add("Review queue", "OK", `${q.queued} queued, ${q.running} running, ${q.failed} failed`);
  } catch (e) {
    add("Review queue", "FAIL", e instanceof Error ? e.message : "unknown error");
  }
}

async function checkLlmSpend() {
  if (!sql) return;
  try {
    const rows = (await sql`
      SELECT COALESCE(SUM(estimated_cost_usd), 0)::float AS spend, COUNT(*)::int AS runs
      FROM content_review_runs WHERE created_at > NOW() - INTERVAL '7 days'
    `) as { spend: number; runs: number }[];
    add("LLM spend (7d)", "OK", `$${(rows[0]?.spend ?? 0).toFixed(4)} across ${rows[0]?.runs ?? 0} run(s)`);
  } catch (e) {
    add("LLM spend (7d)", "WARN", e instanceof Error ? e.message : "unknown error");
  }
}

/** Failed scheduled workflow runs in the last 7 days. GITHUB_TOKEN is injected by Actions. */
async function checkCronRuns() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return add("Cron runs (7d)", "WARN", "no GITHUB_TOKEN/GITHUB_REPOSITORY — skipped (expected outside Actions)");
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100&created=>${since}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) return add("Cron runs (7d)", "WARN", `GitHub API ${res.status}`);
    const data = (await res.json()) as { workflow_runs?: { name: string; conclusion: string | null }[] };
    const runs = data.workflow_runs ?? [];
    const failed = runs.filter((r) => r.conclusion === "failure");
    if (failed.length === 0) return add("Cron runs (7d)", "OK", `${runs.length} run(s), none failed`);
    const byName = failed.reduce<Record<string, number>>((m, r) => ({ ...m, [r.name]: (m[r.name] ?? 0) + 1 }), {});
    const worst = Object.entries(byName).map(([n, c]) => `${n} x${c}`).join(", ");
    add("Cron runs (7d)", failed.length > runs.length * 0.2 ? "FAIL" : "WARN", `${failed.length}/${runs.length} failed: ${worst}`);
  } catch (e) {
    add("Cron runs (7d)", "WARN", e instanceof Error ? e.message : "unknown error");
  }
}

function checkLogFreshness(): string {
  const path = join(process.cwd(), "docs", "ENGINEERING_LOG.md");
  try {
    const body = readFileSync(path, "utf8");
    const start = body.indexOf("## 5. Open backlog");
    const backlog = start === -1 ? "(Open backlog section not found)" : body.slice(start);
    const m = body.match(/Last substantive update:\s*\*\*(\d{4}-\d{2}-\d{2})\*\*/);
    if (m) {
      const days = Math.round((Date.now() - new Date(m[1]).getTime()) / 86_400_000);
      add("Engineering log", days > 30 ? "WARN" : "OK", `last substantive update ${m[1]} (${days} days ago)`);
    } else {
      add("Engineering log", "WARN", "no 'Last substantive update' marker found");
    }
    return backlog;
  } catch {
    add("Engineering log", "FAIL", "docs/ENGINEERING_LOG.md not readable");
    return "(log not readable)";
  }
}

function weekCommits(): string {
  try {
    const out = execSync('git log --since="7 days ago" --no-merges --format="- %s"', { encoding: "utf8" }).trim();
    return out || "- (no non-merge commits this week)";
  } catch {
    return "- (git log unavailable)";
  }
}

function render(backlog: string, commits: string): { subject: string; html: string; markdown: string } {
  const worst: Status = checks.some((c) => c.status === "FAIL") ? "FAIL" : checks.some((c) => c.status === "WARN") ? "WARN" : "OK";
  const icon = { OK: "✅", WARN: "⚠️", FAIL: "❌" };
  const date = new Date().toISOString().slice(0, 10);

  const rows = checks.map((c) => `${icon[c.status]} **${c.name}** — ${c.detail}`).join("\n");
  const markdown = `# Weekly infrastructure review — ${date}

Overall: **${worst}**

## Health checks

${rows}

## Commits this week

${commits}

## ${backlog.replace(/^## /, "")}

---
*Generated by \`.github/workflows/weekly-review.yml\`. Checks are the things that have
previously failed silently — dead crons, a stale standby, a jammed queue, an invisible cost cap.*
`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:680px">
<h2>Weekly infrastructure review — ${date}</h2>
<p>Overall: <strong>${worst}</strong></p>
<h3>Health checks</h3>
<ul>${checks.map((c) => `<li>${icon[c.status]} <strong>${c.name}</strong> — ${c.detail}</li>`).join("")}</ul>
<h3>Commits this week</h3>
<pre style="background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap">${commits.replace(/</g, "&lt;")}</pre>
<h3>Open backlog</h3>
<pre style="background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap">${backlog.replace(/</g, "&lt;").slice(0, 6000)}</pre>
<p style="color:#666;font-size:12px">Generated by .github/workflows/weekly-review.yml</p>
</div>`;

  return { subject: `[${worst}] JapaneseWithAvnish weekly review — ${date}`, html, markdown };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const backlog = checkLogFreshness();
  await checkReplication();
  await checkBackupSync();
  await checkReviewQueue();
  await checkLlmSpend();
  await checkCronRuns();

  const { subject, html, markdown } = render(backlog, weekCommits());

  // Always write the markdown so the workflow can open/update a GitHub issue from it even if
  // the email fails — Gmail SMTP from a CI runner is the least reliable part of this job.
  const { writeFileSync } = await import("fs");
  writeFileSync("weekly-report.md", markdown);

  console.log(markdown);

  if (dryRun) {
    console.log("\n[dry run] no email sent");
    return;
  }

  const to = process.env.REPORT_EMAIL;
  if (!to) {
    console.warn("REPORT_EMAIL not set — skipping email (the issue is still written)");
    return;
  }
  const sent = await sendMail(to, subject, html);
  console.log(sent ? `emailed ${to}` : "sendMail returned null — SMTP not configured?");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
