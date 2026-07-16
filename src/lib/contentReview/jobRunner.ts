import { sql } from "@/lib/db";
import { buildContentSnapshot, checksumSnapshot } from "./snapshot";
import { runDeterministicChecks } from "./deterministicChecks";
import { getAgentRunners } from "./agents";
import { summarizeFindings } from "./agents/finalAggregator";
import type { AgentKey, ContentReviewJob, DraftFinding, ReviewEntityType, TokenUsage } from "./types";

// DeepSeek deepseek-chat pricing (cache-miss rates) as of when this was written — these are
// estimates for the estimated_cost_usd column, not a source of billing truth; update if
// DeepSeek's published pricing changes.
const DEEPSEEK_PROMPT_COST_PER_TOKEN = 0.14 / 1_000_000;
const DEEPSEEK_COMPLETION_COST_PER_TOKEN = 0.28 / 1_000_000;

// Registers each agent's runner into the registry as a module side-effect (registerAgent()
// call at the bottom of each file) — imported here so getAgentRunners() below is populated.
// final_aggregator is deliberately NOT here: it synthesizes the other agents' findings
// rather than analyzing the snapshot directly, so it's called explicitly below instead.
import "./agents/metadataTaxonomy";
import "./agents/japaneseLanguage";
import "./agents/levelAlignment";
import "./agents/practiceAnswer";
import "./agents/contentTypeSpecialist";
import "./agents/grammarReviewer";
import "./agents/vocabularyReviewer";
import "./agents/kanjiReviewer";
import "./agents/readingReviewer";
import "./agents/listeningReviewer";
import "./agents/writingReviewer";
import "./agents/kanaPronunciationReviewer";
import "./agents/exampleSentenceReviewer";
import "./agents/seoReviewer";
import "./agents/trustClaimsReviewer";

const STALE_CLAIM_MINUTES = 10;

export interface UnchangedReviewCheck {
  unchanged: boolean;
  existingRun?: { id: string; overallScore: number | null; overallStatus: string; completedAt: string | null };
}

/** Gap-fix phase 11: skip-if-unchanged. The manual "Run Review" route checks this first — if
 * the post's last COMPLETED run's checksum still matches the current content, re-running the
 * full agent suite would just reproduce identical findings at real LLM cost. A
 * validation_failed/error run doesn't count (nothing was actually checked, so a retry is
 * always allowed regardless of checksum); scheduledReReview.ts and queueReReviewOnEdit
 * already do their own equivalent checksum comparison before ever calling createJob, so this
 * is only needed on the manual path. */
export async function checkUnchangedSinceLastReview(entityType: ReviewEntityType, entityId: string): Promise<UnchangedReviewCheck> {
  if (!sql) return { unchanged: false };
  const rows = (await sql`
    SELECT r.id, r.content_checksum, r.overall_status, r.overall_score, r.completed_at
    FROM posts p
    JOIN content_review_runs r ON r.id = p.last_review_run_id
    WHERE p.id = ${entityId} AND r.overall_status = 'completed'
  `) as { id: string; content_checksum: string; overall_status: string; overall_score: number | null; completed_at: string | null }[];
  const lastRun = rows[0];
  if (!lastRun) return { unchanged: false };

  const snapshot = await buildContentSnapshot(entityType, entityId);
  if (!snapshot || checksumSnapshot(snapshot) !== lastRun.content_checksum) return { unchanged: false };

  return {
    unchanged: true,
    existingRun: { id: lastRun.id, overallScore: lastRun.overall_score, overallStatus: lastRun.overall_status, completedAt: lastRun.completed_at },
  };
}

// Gap-fix phase 23 (part 3 of 3: rate limit). Caps how many jobs one admin can personally
// request in a rolling window — protects against runaway clicking or a scripted mistake, not
// against legitimate bulk work (RUN_LIMIT_WINDOW_MINUTES is generous). System-triggered jobs
// (requestedBy=null: content_edit, bulk_sweep, scheduledReReview) are already separately
// capped (REQUEUE_LIMIT, bulk route's own MAX_BULK_SIZE) and aren't rate-limited here.
const RUN_LIMIT_PER_WINDOW = 30;
const RUN_LIMIT_WINDOW_MINUTES = 10;

export async function createJob(params: {
  entityType: ReviewEntityType;
  entityId: string;
  triggerType: "manual_single" | "bulk_sweep" | "content_edit";
  requestedBy: string | null;
  requestedAgentKeys?: AgentKey[] | null;
}): Promise<{ id: string } | { error: string; status: number }> {
  if (!sql) return { error: "Database unavailable", status: 503 };

  if (params.requestedBy) {
    const recentRows = (await sql`
      SELECT COUNT(*)::int AS count FROM content_review_jobs
      WHERE requested_by = ${params.requestedBy} AND created_at > NOW() - make_interval(mins => ${RUN_LIMIT_WINDOW_MINUTES})
    `) as { count: number }[];
    if ((recentRows[0]?.count ?? 0) >= RUN_LIMIT_PER_WINDOW) {
      return { error: `Rate limit reached: at most ${RUN_LIMIT_PER_WINDOW} review jobs per ${RUN_LIMIT_WINDOW_MINUTES} minutes per admin.`, status: 429 };
    }
  }

  try {
    const rows = (await sql`
      INSERT INTO content_review_jobs (entity_type, entity_id, trigger_type, requested_by, requested_agent_keys)
      VALUES (${params.entityType}, ${params.entityId}, ${params.triggerType}, ${params.requestedBy}, ${params.requestedAgentKeys ?? null})
      RETURNING id
    `) as { id: string }[];
    await sql`UPDATE posts SET review_state = 'queued' WHERE id = ${params.entityId}`;
    return { id: rows[0].id };
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "23505") return { error: "A review is already in progress for this content.", status: 409 };
    if (e?.code === "23503") return { error: "No matching content found for that entityId.", status: 404 };
    throw err;
  }
}

/** Gap-fix phase 23 (part 1 of 3: job cancellation). Only 'queued' jobs are cancellable —
 * once a job is 'claimed'/'running' it's actively mid-flight in some process (inline call or
 * cron tick), and this codebase's queue has no interrupt mechanism for that; it'll finish on
 * its own shortly. Resets the post's review_state back to 'not_reviewed' only if nothing else
 * queued a newer job for it in the meantime (rare race, but cheap to guard). */
export async function cancelJob(jobId: string): Promise<{ ok: true } | { error: string; status: number }> {
  if (!sql) return { error: "Database unavailable", status: 503 };
  const rows = (await sql`
    UPDATE content_review_jobs SET status = 'cancelled', completed_at = NOW()
    WHERE id = ${jobId} AND status = 'queued'
    RETURNING entity_id
  `) as { entity_id: string }[];
  if (!rows[0]) return { error: "Job not found or not in a cancellable (queued) state.", status: 409 };

  await sql`
    UPDATE posts SET review_state = 'not_reviewed'
    WHERE id = ${rows[0].entity_id} AND review_state = 'queued'
      AND NOT EXISTS (SELECT 1 FROM content_review_jobs j WHERE j.entity_id = ${rows[0].entity_id} AND j.status IN ('queued', 'claimed', 'running'))
  `;
  return { ok: true };
}

/** Atomic claim: FOR UPDATE SKIP LOCKED prevents a concurrent claimer (inline single-item
 * call racing the cron tick) from double-processing the same job. The stale-reclaim branch
 * recovers jobs orphaned by a killed/timed-out invocation. */
export async function claimNextJob(): Promise<ContentReviewJob | null> {
  if (!sql) return null;
  const rows = (await sql`
    UPDATE content_review_jobs
    SET status = 'claimed', claimed_at = NOW(), attempt_count = attempt_count + 1
    WHERE id = (
      SELECT id FROM content_review_jobs
      WHERE status = 'queued'
         OR (status IN ('claimed', 'running') AND claimed_at < NOW() - make_interval(mins => ${STALE_CLAIM_MINUTES}))
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, entity_type, entity_id, trigger_type, status, requested_agent_keys,
              attempt_count, max_attempts, error_message, requested_by, created_at, started_at, completed_at
  `) as {
    id: string;
    entity_type: string;
    entity_id: string;
    trigger_type: string;
    status: string;
    requested_agent_keys: string[] | null;
    attempt_count: number;
    max_attempts: number;
    error_message: string | null;
    requested_by: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  }[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entity_type as ReviewEntityType,
    entityId: row.entity_id,
    triggerType: row.trigger_type as "manual_single" | "bulk_sweep" | "content_edit",
    status: row.status as ContentReviewJob["status"],
    requestedAgentKeys: row.requested_agent_keys,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function scoreFindings(findings: DraftFinding[]): number {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const majors = findings.filter((f) => f.severity === "major").length;
  const minors = findings.filter((f) => f.severity === "minor").length;
  return Math.max(0, 100 - 25 * criticals - 10 * majors - 3 * minors);
}

/** Per-agent score breakdown (category_scores), using the same formula as the overall
 * score but scoped to one agent's own findings — the spec's aggregator output shows a
 * per-category breakdown (japaneseAccuracy, levelFit, practice, etc.); this maps those
 * categories onto this system's actual agent_keys rather than inventing category names
 * that don't correspond to anything actually built. Seeded from agentKeysRun (not just
 * allFindings) so an agent that ran and found nothing scores a clean 100 instead of being
 * silently omitted from category_scores entirely — omission reads as "not checked," which
 * is wrong when it actually means "checked, no issues." final_aggregator is excluded since
 * it synthesizes other agents' findings rather than producing its own. */
function scoreByCategory(allFindings: { agentKey: string; finding: DraftFinding }[], agentKeysRun: Set<string>): Record<string, number> {
  const byAgent = new Map<string, DraftFinding[]>();
  for (const agentKey of Array.from(agentKeysRun)) {
    if (agentKey === "final_aggregator") continue;
    byAgent.set(agentKey, []);
  }
  for (const { agentKey, finding } of allFindings) {
    if (!byAgent.has(agentKey)) byAgent.set(agentKey, []);
    byAgent.get(agentKey)!.push(finding);
  }
  const scores: Record<string, number> = {};
  for (const [agentKey, findings] of Array.from(byAgent.entries())) {
    scores[agentKey] = scoreFindings(findings);
  }
  return scores;
}

async function failJob(jobId: string, entityId: string, message: string, attemptCount: number, maxAttempts: number) {
  if (!sql) return;
  if (attemptCount < maxAttempts) {
    // Leave it queued for another attempt (by this process or the next cron tick).
    await sql`UPDATE content_review_jobs SET status = 'queued', error_message = ${message} WHERE id = ${jobId}`;
  } else {
    await sql`UPDATE content_review_jobs SET status = 'failed', error_message = ${message}, completed_at = NOW() WHERE id = ${jobId}`;
    await sql`UPDATE posts SET review_state = 'not_reviewed' WHERE id = ${entityId}`;
  }
}

/** Runs one claimed job to completion. Always runs the deterministic pass first (folded
 * into metadata_taxonomy, per the plan); a hard failure short-circuits before any LLM call.
 * Agent runners beyond the deterministic pass are looked up via getAgentRunners() — empty
 * until Phase D/E register them, so Phase C jobs are deterministic-only end-to-end. */
export async function runClaimedJob(job: ContentReviewJob): Promise<void> {
  if (!sql) return;

  try {
    await sql`UPDATE content_review_jobs SET status = 'running', started_at = COALESCE(started_at, NOW()) WHERE id = ${job.id}`;
    await sql`UPDATE posts SET review_state = 'validating' WHERE id = ${job.entityId}`;

    const snapshot = await buildContentSnapshot(job.entityType, job.entityId);
    if (!snapshot) {
      await failJob(job.id, job.entityId, "Content not found for this entity_id/entity_type.", job.attemptCount, job.maxAttempts);
      return;
    }

    const checksum = checksumSnapshot(snapshot);
    const runRows = (await sql`
      INSERT INTO content_review_runs (job_id, entity_type, entity_id, content_snapshot, content_checksum, overall_status)
      VALUES (${job.id}, ${job.entityType}, ${job.entityId}, ${JSON.stringify(snapshot)}::jsonb, ${checksum}, 'pending')
      RETURNING id
    `) as { id: string }[];
    const runId = runRows[0].id;

    const det = await runDeterministicChecks(snapshot);

    if (det.hardFail) {
      await sql`
        UPDATE content_review_runs
        SET overall_status = 'validation_failed', summary = ${det.hardFail.reason}, completed_at = NOW()
        WHERE id = ${runId}
      `;
      await sql`UPDATE posts SET review_state = 'validation_failed', last_review_run_id = ${runId} WHERE id = ${job.entityId}`;
      await sql`UPDATE content_review_jobs SET status = 'completed', completed_at = NOW() WHERE id = ${job.id}`;
      return;
    }

    await sql`UPDATE posts SET review_state = 'ai_reviewing' WHERE id = ${job.entityId}`;

    const allFindings: { agentKey: string; finding: DraftFinding }[] = det.findings.map((f) => ({
      agentKey: "metadata_taxonomy",
      finding: f,
    }));
    const agentKeysRun = new Set<string>(["metadata_taxonomy"]);
    let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };

    const runners = getAgentRunners();
    const scopeKeys = job.requestedAgentKeys && job.requestedAgentKeys.length > 0 ? job.requestedAgentKeys : null;
    // content_review_agents.scope/is_enabled were seeded but never actually read anywhere —
    // enforced here now, since the new type-specific agents (grammar_reviewer etc.) genuinely
    // need to be skipped for the other 6 content types rather than relying on each agent
    // internally no-op'ing (the pattern practice_answer used before this existed).
    const agentMetaRows = (await sql`SELECT agent_key, scope, is_enabled, model_name, temperature FROM content_review_agents`) as {
      agent_key: string;
      scope: string[];
      is_enabled: boolean;
      model_name: string;
      temperature: number;
    }[];
    const agentMeta = new Map(agentMetaRows.map((r) => [r.agent_key, r]));
    // Gap-fix phase 12 (model-tiering): metadata_taxonomy's own row supplies the deterministic
    // pass's "agent" identity is separate (det.findings has no LLM call of its own), but
    // final_aggregator's real DeepSeek call below does need its own configured model/temperature.
    const aggregatorMeta = agentMeta.get("final_aggregator");
    // Publish gate's requiredAgentFailures check needs this recorded, not just console.error'd —
    // previously an agent throwing was silently swallowed with no queryable trace.
    const failedAgentKeys: string[] = [];

    for (const [agentKey, runner] of Array.from(runners.entries())) {
      if (scopeKeys && !scopeKeys.includes(agentKey)) continue;
      const meta = agentMeta.get(agentKey);
      if (meta && !meta.is_enabled) continue;
      if (meta && meta.scope.length > 0 && !meta.scope.includes(job.entityType)) continue;
      try {
        const result = await runner(snapshot, { modelName: meta?.model_name ?? "deepseek-chat", temperature: meta?.temperature ?? 0.1 });
        agentKeysRun.add(agentKey);
        for (const f of result.findings) allFindings.push({ agentKey, finding: f });
        if (result.usage) totalUsage = { promptTokens: totalUsage.promptTokens + result.usage.promptTokens, completionTokens: totalUsage.completionTokens + result.usage.completionTokens };
      } catch (err) {
        console.error(`[content-review] agent ${agentKey} failed:`, err);
        failedAgentKeys.push(agentKey);
      }
    }

    // RETURNING id in the same iteration order as allFindings, so the aggregator's
    // duplicate-group indices (positions into allFindings) can be mapped to real finding ids.
    const findingIds: string[] = [];
    for (const { agentKey, finding } of allFindings) {
      const inserted = (await sql`
        INSERT INTO content_review_findings
          (review_run_id, agent_key, severity, category, field_name, original_value, suggested_value, title, description, why_it_matters)
        VALUES (
          ${runId}, ${agentKey}, ${finding.severity}, ${finding.category}, ${finding.fieldName ?? null},
          ${finding.originalValue !== undefined ? JSON.stringify(finding.originalValue) : null}::jsonb,
          ${finding.suggestedValue !== undefined ? JSON.stringify(finding.suggestedValue) : null}::jsonb,
          ${finding.title}, ${finding.description}, ${finding.whyItMatters ?? null}
        )
        RETURNING id
      `) as { id: string }[];
      findingIds.push(inserted[0].id);
    }

    const overallScore = scoreFindings(allFindings.map((f) => f.finding));
    const categoryScores = scoreByCategory(allFindings, agentKeysRun);
    const aggregatorResult = await summarizeFindings(
      allFindings.map((f) => f.finding),
      aggregatorMeta ? { modelName: aggregatorMeta.model_name, temperature: aggregatorMeta.temperature } : undefined
    );
    agentKeysRun.add("final_aggregator");
    totalUsage = {
      promptTokens: totalUsage.promptTokens + aggregatorResult.usage.promptTokens,
      completionTokens: totalUsage.completionTokens + aggregatorResult.usage.completionTokens,
    };
    const duplicateGroups = aggregatorResult.duplicateGroupIndices.map((group) => group.map((i) => findingIds[i]));
    const estimatedCostUsd =
      totalUsage.promptTokens * DEEPSEEK_PROMPT_COST_PER_TOKEN + totalUsage.completionTokens * DEEPSEEK_COMPLETION_COST_PER_TOKEN;

    await sql`
      UPDATE content_review_runs
      SET overall_status = 'completed', overall_score = ${overallScore}, summary = ${aggregatorResult.summary},
          agent_keys_run = ${Array.from(agentKeysRun)}, duplicate_groups = ${JSON.stringify(duplicateGroups)}::jsonb,
          failed_agent_keys = ${failedAgentKeys}, total_prompt_tokens = ${totalUsage.promptTokens},
          total_completion_tokens = ${totalUsage.completionTokens}, estimated_cost_usd = ${estimatedCostUsd},
          category_scores = ${JSON.stringify(categoryScores)}::jsonb,
          publish_ready = ${!allFindings.some((f) => f.finding.severity === "critical")}, completed_at = NOW()
      WHERE id = ${runId}
    `;
    // Always lands on needs_human_review, even with zero findings — a human must explicitly
    // approve (see publishGate/Phase F), matching the core rule that AI never publishes itself.
    await sql`UPDATE posts SET review_state = 'needs_human_review', last_review_run_id = ${runId} WHERE id = ${job.entityId}`;
    await sql`UPDATE content_review_jobs SET status = 'completed', completed_at = NOW() WHERE id = ${job.id}`;
  } catch (err) {
    console.error("[content-review] job failed:", err);
    await failJob(job.id, job.entityId, err instanceof Error ? err.message : String(err), job.attemptCount, job.maxAttempts);
  }
}

// Gap-fix phase 23 (part 2 of 3: cost cap). Estimate-based, not billing truth (same caveat
// as estimated_cost_usd itself) — a simple circuit breaker against runaway LLM spend, not a
// precise budget system. Configurable via env since "how much is acceptable" is a business
// call the founder should be able to tune without a code change.
const DAILY_COST_CAP_USD = Number(process.env.REVIEW_DAILY_COST_CAP_USD) || 5;

async function isDailyCostCapReached(): Promise<boolean> {
  if (!sql) return false;
  const rows = (await sql`
    SELECT COALESCE(SUM(estimated_cost_usd), 0)::float AS total
    FROM content_review_runs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `) as { total: number }[];
  return (rows[0]?.total ?? 0) >= DAILY_COST_CAP_USD;
}

/** Claims and runs up to `limit` queued jobs, stopping early once a claim returns nothing —
 * or before claiming anything at all if the daily cost cap has been reached. Checked here
 * (before claimNextJob, not inside runClaimedJob) so a cap-blocked tick never claims a job in
 * the first place — leaves it 'queued' with attempt_count untouched, rather than counting
 * against max_attempts as if the job itself had failed. */
export async function drainQueue(limit: number): Promise<number> {
  if (await isDailyCostCapReached()) {
    console.warn(`[content-review] daily cost cap ($${DAILY_COST_CAP_USD}) reached — skipping this drain tick`);
    return 0;
  }
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob();
    if (!job) break;
    await runClaimedJob(job);
    processed++;
  }
  return processed;
}
