import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Gap-fix phase 9. Cross-cutting reviewer (vocabulary/grammar/kanji/reading —
 * content_review_agents.scope) focused narrowly on worked example sentences, wherever they
 * live: posts.content for all four types, plus grammar_drill_items for grammar. Distinct from
 * japanese_language (broad grammaticality) and the per-type reviewers (taxonomy/structure):
 * this agent's only question is whether each example actually demonstrates the specific
 * word/pattern/character it's attached to, not just whether it's grammatically valid Japanese. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("example_sentence_reviewer");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
    wrapUntrustedContent("example_drills", snapshot.practice),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "example_sentence_reviewer", findings, usage };
}

registerAgent("example_sentence_reviewer", run);
