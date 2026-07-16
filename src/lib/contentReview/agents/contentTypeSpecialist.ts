import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot } from "../types";

/** One prompt parameterized by content_type (via {{content_type}} substitution in
 * getReviewAgentPrompt), rather than 6 separate agent implementations — mirrors the
 * existing getPrompt(contentType, ...) pattern in src/lib/ai/prompts.ts.
 *
 * Listening audio-completeness is deliberately NOT checked here: getCompleteListeningPostIds()
 * (src/lib/learn/listeningPublishGate.ts) checks listening_scenarios.audio_url, not the
 * top-level listening.audio_url column this agent's sidecar data exposes — the latter is
 * apparently unused/vestigial across all sampled published rows, so checking it here would
 * produce a false "no audio" finding on essentially every listening post. That check lives
 * in practiceAnswer.ts instead, against the real scenario-level data already in the snapshot. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const systemPrompt = await getReviewAgentPrompt("content_type_specialist", snapshot.entityType);
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("structured_fields", snapshot.sidecar),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  const { findings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 2000, model: config.modelName, temperature: config.temperature });
  return { agentKey: "content_type_specialist", findings, usage };
}

registerAgent("content_type_specialist", run);
