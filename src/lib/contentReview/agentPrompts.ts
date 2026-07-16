import { getPromptContent } from "@/lib/ai/load-prompts";
import type { AgentKey } from "./types";

// Mirrors content_review_agents.prompt_key from the seed migration (101). Kept as a plain
// map here (not a runtime DB lookup) since the finding schema each prompt promises is
// coupled to the code that parses its output — changing the mapping is a code change either way.
const AGENT_PROMPT_KEYS: Record<AgentKey, string> = {
  metadata_taxonomy: "content_review_metadata_taxonomy",
  japanese_language: "content_review_japanese_language",
  level_alignment: "content_review_level_alignment",
  practice_answer: "content_review_practice_answer",
  content_type_specialist: "content_review_content_type_specialist",
  final_aggregator: "content_review_final_aggregator",
  grammar_reviewer: "content_review_grammar_reviewer",
  vocabulary_reviewer: "content_review_vocabulary_reviewer",
  kanji_reviewer: "content_review_kanji_reviewer",
  reading_reviewer: "content_review_reading_reviewer",
  listening_reviewer: "content_review_listening_reviewer",
  writing_reviewer: "content_review_writing_reviewer",
  kana_pronunciation_reviewer: "content_review_kana_pronunciation_reviewer",
  example_sentence_reviewer: "content_review_example_sentence_reviewer",
  seo_reviewer: "content_review_seo_reviewer",
  trust_claims_reviewer: "content_review_trust_claims_reviewer",
};

/** The shared injection-defense prefix + the agent's own task-specific prompt. Both keys are
 * in POLICY_EXCLUDED_KEYS (src/lib/ai/load-prompts.ts) so getPromptContent() returns each
 * one's raw text without the unrelated shared_content_policy (a content-generation/brand-voice
 * concern) getting prepended. */
export async function getReviewAgentPrompt(agentKey: AgentKey, contentType?: string): Promise<string> {
  const [shared, task] = await Promise.all([
    getPromptContent("content_review_shared_policy"),
    getPromptContent(AGENT_PROMPT_KEYS[agentKey]),
  ]);
  let taskPrompt = task ?? "";
  if (contentType) taskPrompt = taskPrompt.replaceAll("{{content_type}}", contentType);
  return [shared, taskPrompt].filter(Boolean).join("\n\n---\n\n");
}
