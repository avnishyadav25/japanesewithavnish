import { sql } from "@/lib/db";

export const ALLOWED_PROMPT_KEYS = [
  "shared_content_policy",
  "tutor_system",
  "correct_sentence",
  "next_steps",
  "daily_checkpoint",
  "blog_summary",
  "curriculum_lesson_intro",
  "curriculum_lesson_body",
  "curriculum_lesson_vocab",
  "curriculum_examples",
  "curriculum_suggest_summary",
  "curriculum_suggest_next",
  "curriculum_feature_image",
  "contact_reply",
  "comment_reply",
  "feedback_reply",
  "reengagement_nudge",
  "content_gen_brand",
  "content_gen_tone_rules",
  "content_gen_lesson_style",
  "content_review_shared_policy",
  "content_review_metadata_taxonomy",
  "content_review_japanese_language",
  "content_review_level_alignment",
  "content_review_practice_answer",
  "content_review_content_type_specialist",
  "content_review_final_aggregator",
  "content_review_grammar_reviewer",
  "content_review_vocabulary_reviewer",
  "content_review_kanji_reviewer",
  "content_review_reading_reviewer",
  "content_review_listening_reviewer",
  "content_review_writing_reviewer",
  "content_review_kana_pronunciation_reviewer",
  "content_review_example_sentence_reviewer",
  "content_review_seo_reviewer",
  "content_review_trust_claims_reviewer",
] as const;

export type PromptKey = (typeof ALLOWED_PROMPT_KEYS)[number];

export function isAllowedPromptKey(key: string): key is PromptKey {
  return ALLOWED_PROMPT_KEYS.includes(key as PromptKey);
}

// Text-generation prompts (not image prompts) get the shared accuracy/content policy
// prepended automatically, so it only needs to be maintained in one place.
const POLICY_EXCLUDED_KEYS = new Set<string>([
  "shared_content_policy",
  "curriculum_feature_image",
  "content_gen_brand",
  "content_gen_tone_rules",
  "content_gen_lesson_style",
  // Content Review Center prompts assemble their own shared prefix (content_review_shared_policy,
  // an injection-defense policy) via getReviewAgentPrompt() in src/lib/contentReview/agentPrompts.ts —
  // excluded here so the unrelated content-generation/brand-voice policy isn't also prepended.
  "content_review_shared_policy",
  "content_review_metadata_taxonomy",
  "content_review_japanese_language",
  "content_review_level_alignment",
  "content_review_practice_answer",
  "content_review_content_type_specialist",
  "content_review_final_aggregator",
  "content_review_grammar_reviewer",
  "content_review_vocabulary_reviewer",
  "content_review_kanji_reviewer",
  "content_review_reading_reviewer",
  "content_review_listening_reviewer",
  "content_review_writing_reviewer",
  "content_review_kana_pronunciation_reviewer",
  "content_review_example_sentence_reviewer",
  "content_review_seo_reviewer",
  "content_review_trust_claims_reviewer",
]);

async function getRawPromptContent(key: string): Promise<string | null> {
  if (!sql) return null;
  try {
    const rows = await sql`
      SELECT content FROM ai_prompts WHERE key = ${key} LIMIT 1
    ` as { content: string }[];
    return rows?.[0]?.content ?? null;
  } catch {
    return null;
  }
}

/** Load prompt content from ai_prompts by key. Returns null if not found or DB unavailable.
 * Automatically prepends the shared content policy for every text prompt (image prompts excluded). */
export async function getPromptContent(key: string): Promise<string | null> {
  const content = await getRawPromptContent(key);
  if (!content) return content;
  if (POLICY_EXCLUDED_KEYS.has(key)) {
    return content;
  }
  const policy = await getRawPromptContent("shared_content_policy");
  return policy ? `${policy}\n\n---\n\n${content}` : content;
}
