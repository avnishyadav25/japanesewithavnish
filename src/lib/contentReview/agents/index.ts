import type { AgentResult, ContentSnapshot } from "../types";

/** Gap-fix phase 12 (model-tiering): per-agent model_name/temperature, read fresh from
 * content_review_agents by jobRunner.ts on every run (not cached) so an admin's edit on
 * /admin/review/agents takes effect on the very next review. */
export interface AgentRunConfig {
  modelName: string;
  temperature: number;
}

export type AgentRunner = (snapshot: ContentSnapshot, config: AgentRunConfig) => Promise<AgentResult>;

// Populated incrementally as each agent module is built (Phase D/E). Until then,
// runClaimedJob() only ever produces the deterministic metadata_taxonomy findings —
// this is what makes the Phase C queue "deterministic-only end-to-end."
const registry = new Map<string, AgentRunner>();

export function registerAgent(agentKey: string, runner: AgentRunner): void {
  registry.set(agentKey, runner);
}

export function getAgentRunners(): Map<string, AgentRunner> {
  return registry;
}
