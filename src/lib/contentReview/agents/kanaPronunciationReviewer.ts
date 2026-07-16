import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Gap-fix phase 9. Dedicated reviewer for sounds (kana/pronunciation) content — the sounds
 * table (title/level/notes) is as sparse as writing's, so the actual pronunciation guidance,
 * kana charts, and romanization live in posts.content. Replaces content_type_specialist's
 * one-line "writing/sounds" coverage for this type (content_type_specialist is now disabled —
 * see migration 109). */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("kana_pronunciation_reviewer");
  const userMessage = [
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "kana_pronunciation_reviewer", findings, usage };
}

registerAgent("kana_pronunciation_reviewer", run);
