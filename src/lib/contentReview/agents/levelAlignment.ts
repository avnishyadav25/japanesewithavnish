import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot, DraftFinding } from "../types";

/** Founder's "Curriculum Alignment Reviewer," reinterpreted: curriculum_lessons is out of
 * scope per decision #1 (kept separate from lesson_blocks.review_status), so this checks
 * declared-level/type fit using only posts-level signals — no curriculum-sequence access. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const findings: DraftFinding[] = [];

  if (!snapshot.post.jlptLevel || snapshot.post.jlptLevel.length === 0) {
    findings.push({
      severity: "major",
      category: "level_fit",
      fieldName: "jlpt_level",
      title: "No JLPT level assigned",
      description: "This content has no jlpt_level set, so learners can't find it via level-filtered browsing and this agent can't judge difficulty fit.",
    });
    return { agentKey: "level_alignment", findings };
  }

  const systemPrompt = await getReviewAgentPrompt("level_alignment");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    `jlpt_level: ${JSON.stringify(snapshot.post.jlptLevel)}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  const { findings: llmFindings, usage } = await callReviewAgent({ systemPrompt, userMessage, model: config.modelName, temperature: config.temperature });
  return { agentKey: "level_alignment", findings: [...findings, ...llmFindings], usage };
}

registerAgent("level_alignment", run);
