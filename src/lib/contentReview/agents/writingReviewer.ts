import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Gap-fix phase 9. Dedicated reviewer for writing (production/output exercises) — the
 * writing table (title/level/notes) is the sparsest sidecar of any type, so almost
 * everything worth checking lives in posts.content: the prompt itself, and any sample/model
 * answer included alongside it. Replaces content_type_specialist's one-line "writing/sounds"
 * coverage for this type (content_type_specialist is now disabled — see migration 109). */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("writing_reviewer");
  const userMessage = [
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "writing_reviewer", findings, usage };
}

registerAgent("writing_reviewer", run);
