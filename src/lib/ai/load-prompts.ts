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
  "learning_vocabulary_image",
  "learning_grammar_image",
  "learning_kanji_image",
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
  "video_narration_shared",
  "video_narration_vocabulary",
  "video_narration_kanji",
  "video_narration_grammar",
  "video_narration_reading",
  "video_narration_listening",
  "video_narration_lesson",
  "video_metadata_seo",
  // Social engine — one key per surface (src/lib/social/platforms.ts). These carry voice and
  // craft only; character limits and hashtag counts live in PLATFORM_RULES and are enforced in
  // code after generation, so editing a prompt here cannot break a platform's limits.
  // Seeded by supabase/migrations/144_social_prompt_keys.sql — /admin/prompts has no POST, so a
  // key without a seeded row would be invisible and uneditable.
  "social_shared_brand",
  "social_youtube_long",
  "social_youtube_short",
  "social_instagram_reel",
  "social_instagram_post",
  "social_instagram_carousel",
  "social_x_post",
  "social_x_thread",
  "social_facebook_post",
  "social_threads_post",
  "social_tiktok_video",
  "social_pinterest_pin",
  "social_linkedin_post",
  "social_linkedin_article",
  "social_reddit_post",
  "social_blog_article",
  "social_content_plan",
  "social_plan_hint",
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
  "learning_vocabulary_image",
  "learning_grammar_image",
  "learning_kanji_image",
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
  // Video Studio narration prompts carry their own rule set (src/lib/video/storyboard.ts).
  // The shared content policy is written for on-page prose and permits markdown; these prompts
  // produce words that go straight into a text-to-speech voice, where a stray asterisk or
  // heading marker is read aloud. Their accuracy rules are stated inline instead.
  "video_narration_shared",
  "video_narration_vocabulary",
  "video_narration_kanji",
  "video_narration_grammar",
  "video_narration_reading",
  "video_narration_listening",
  "video_narration_lesson",
  "video_metadata_seo",
  // Social CONTENT prompts are deliberately NOT excluded — a caption makes the same public
  // claims about Japanese that a lesson page does, so the shared accuracy policy applies. Only
  // the two scheduling prompts below are excluded: they contain no Japanese and produce no
  // learner-facing prose, so the content policy is dead weight in their context window.
  "social_content_plan",
  "social_plan_hint",
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
