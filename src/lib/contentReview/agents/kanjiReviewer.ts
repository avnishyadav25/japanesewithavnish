import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Phase 2 dedicated reviewer (kanji only). Deterministic multi-character and
 * rare-meaning-regex checks already run under metadata_taxonomy — this is the deeper LLM
 * pass: reading-priority order, and primary-meaning vs. meaning_extended split quality. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("kanji_reviewer");
  const userMessage = [
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "kanji_reviewer", findings, usage };
}

registerAgent("kanji_reviewer", run);
