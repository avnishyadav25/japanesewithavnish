import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Phase 2 dedicated reviewer (vocabulary only). Deterministic shape checks (hiragana-only
 * word===reading, grammar-shaped word, duplicates) already run in deterministicChecks.ts
 * under metadata_taxonomy — this is the deeper LLM pass: canonical-form/reading/meaning
 * accuracy, part-of-speech/transitivity correctness, and rare-meaning-as-primary detection. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("vocabulary_reviewer");
  const userMessage = [
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "vocabulary_reviewer", findings, usage };
}

registerAgent("vocabulary_reviewer", run);
