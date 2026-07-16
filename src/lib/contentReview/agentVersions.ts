import { sql } from "@/lib/db";
import { createJob } from "./jobRunner";
import type { ReviewEntityType } from "./types";

const REQUEUE_LIMIT = 200;

/** Gap-fix phase 21: prompt/model version-changed trigger. Content previously checked by
 * this agent (agent_key appears in its last run's agent_keys_run) was assessed under the
 * OLD configuration — queue a re-review so it gets re-checked under the new one. Capped
 * (LIMIT 200) and cron-drained like any other bulk_sweep job, not inline-awaited here, so a
 * single config edit can't itself cause an LLM cost/latency spike. */
async function queueReReviewForAgentChange(agentKey: string): Promise<number> {
  if (!sql) return 0;
  const rows = (await sql`
    SELECT p.id, p.content_type
    FROM posts p
    JOIN content_review_runs r ON r.id = p.last_review_run_id
    WHERE ${agentKey} = ANY(r.agent_keys_run)
      AND NOT EXISTS (SELECT 1 FROM content_review_jobs j WHERE j.entity_id = p.id AND j.status IN ('queued', 'claimed', 'running'))
    LIMIT ${REQUEUE_LIMIT}
  `) as { id: string; content_type: string }[];

  let queued = 0;
  for (const row of rows) {
    const created = await createJob({ entityType: row.content_type as ReviewEntityType, entityId: row.id, triggerType: "bulk_sweep", requestedBy: null });
    if ("id" in created) queued++;
    // A 409 here just means another process already queued a job for this post — fine.
  }
  return queued;
}

/** Gap-fix phase 18 (+ phase 21). Called after any write that changes an agent's effective
 * configuration (Agent Configuration's model_name/temperature/scope/is_enabled, or a prompt
 * edit at /admin/prompts for that agent's prompt_key) — snapshots the agent's full resulting
 * state so past runs' results can be traced back to exactly what configuration produced
 * them, then queues a re-review for content that agent previously checked, since it was
 * assessed under the now-stale configuration. */
export async function recordAgentVersion(agentKey: string, changedBy: string | null): Promise<void> {
  if (!sql) return;
  const rows = (await sql`
    SELECT a.model_name, a.temperature, a.scope, a.is_enabled, p.content AS prompt_content
    FROM content_review_agents a
    LEFT JOIN ai_prompts p ON p.key = a.prompt_key
    WHERE a.agent_key = ${agentKey}
  `) as { model_name: string; temperature: number; scope: string[]; is_enabled: boolean; prompt_content: string | null }[];
  const agent = rows[0];
  if (!agent) return;

  await sql`
    INSERT INTO review_agent_versions (agent_key, model_name, temperature, scope, is_enabled, prompt_content, changed_by)
    VALUES (${agentKey}, ${agent.model_name}, ${agent.temperature}, ${agent.scope}, ${agent.is_enabled}, ${agent.prompt_content}, ${changedBy})
  `;

  await queueReReviewForAgentChange(agentKey);
}

/** Reverse lookup for the prompts editor: given an ai_prompts key, which agent_key (if any)
 * uses it as its prompt_key. Returns null for prompts not tied to one specific agent (e.g.
 * content_review_shared_policy, which prefixes every agent's prompt rather than being any
 * one agent's own version). */
export async function findAgentKeyByPromptKey(promptKey: string): Promise<string | null> {
  if (!sql) return null;
  const rows = (await sql`SELECT agent_key FROM content_review_agents WHERE prompt_key = ${promptKey}`) as { agent_key: string }[];
  return rows[0]?.agent_key ?? null;
}
