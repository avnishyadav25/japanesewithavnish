import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Gap-fix phase 9. Cross-cutting reviewer (scope='{}', all 7 types) for unverifiable or
 * fabricated claims — split out into its own agent so it gets real category_scores/analytics
 * visibility instead of being a buried aside in level_alignment's prompt. Supersedes that
 * aside: migration 109/110 strips the old "official JLPT" mention from
 * content_review_level_alignment so the same issue isn't double-flagged by two agents. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("trust_claims_reviewer");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 1500, model: config.modelName, temperature: config.temperature });
  return { agentKey: "trust_claims_reviewer", findings, usage };
}

registerAgent("trust_claims_reviewer", run);
