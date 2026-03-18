import { sql } from "@/lib/db";

export const ALLOWED_PROMPT_KEYS = [
  "tutor_system",
  "correct_sentence",
  "next_steps",
  "daily_checkpoint",
  "blog_summary",
  "curriculum_lesson_intro",
  "curriculum_lesson_vocab",
  "curriculum_examples",
  "curriculum_suggest_summary",
  "curriculum_suggest_next",
  "curriculum_feature_image",
] as const;

export type PromptKey = (typeof ALLOWED_PROMPT_KEYS)[number];

export function isAllowedPromptKey(key: string): key is PromptKey {
  return ALLOWED_PROMPT_KEYS.includes(key as PromptKey);
}

/** Load prompt content from ai_prompts by key. Returns null if not found or DB unavailable. */
export async function getPromptContent(key: string): Promise<string | null> {
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
