import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

// The deterministic pass for this agent (required fields, duplicates, shape heuristics,
// missing-sidecar-row) runs directly inside jobRunner.ts before any agent is called at all —
// this module is only the small LLM pass on top: does title/summary/tags plausibly match
// the declared level/type. Both halves are tagged with the same agent_key="metadata_taxonomy".
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("metadata_taxonomy");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("summary", snapshot.post.summary),
    wrapUntrustedContent("tags", snapshot.post.tags),
  ].join("\n\n");

  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, model: config.modelName, temperature: config.temperature });
  return { agentKey: "metadata_taxonomy", findings, usage };
}

registerAgent("metadata_taxonomy", run);
