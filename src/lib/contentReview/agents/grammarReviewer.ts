import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** Phase 2 dedicated reviewer (grammar only, per content_review_agents.scope, now actually
 * enforced in jobRunner.ts). Replaces content_type_specialist's coverage of grammar with a
 * deeper rubric: formation accuracy, register/nuance, and specifically the "X=casual,
 * Y=formal" style of oversimplification the founder's spec called out by name. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("grammar_reviewer");
  const userMessage = [
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
    wrapUntrustedContent("example_drills", snapshot.practice),
  ].join("\n\n");

  // maxTokens raised for gap-fix phase 12 (default model moves to the reasoning-tier
  // deepseek-v4-pro, which spends completion tokens on internal reasoning before the JSON).
  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 4000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "grammar_reviewer", findings, usage };
}

registerAgent("grammar_reviewer", run);
