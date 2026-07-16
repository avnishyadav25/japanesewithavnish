import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** The highest-priority specialist per the founder's spec. Reads posts.content plus
 * whatever Japanese-language structured fields the sidecar table has (word/reading/meaning,
 * pattern/structure, character/onyomi/kunyomi) — shape varies by entityType, so we just hand
 * over the whole sidecar object and let the prompt's per-type guidance do the rest. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("japanese_language");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12: this agent now defaults to deepseek-v4-pro, a
  // reasoning model that spends completion tokens on internal reasoning before emitting the
  // findings JSON — too low a ceiling risks getting cut off mid-thought with no actual output.
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "japanese_language", findings, usage };
}

registerAgent("japanese_language", run);
