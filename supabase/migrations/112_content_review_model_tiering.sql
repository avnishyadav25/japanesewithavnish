-- Gap-fix phase 12 (model-tiering): now that content_review_agents.model_name/temperature
-- actually reach the real DeepSeek call (callReviewAgent.ts + jobRunner.ts's per-agent
-- config lookup), assign the ~9 deepest Japanese-language-judgment agents to deepseek-v4-pro
-- (a real reasoning-tier model, confirmed working directly against the API) and leave the
-- lighter/structural agents on the existing deepseek-chat (deepseek-v4-flash) default.
SET search_path TO public;

UPDATE content_review_agents SET model_name = 'deepseek-v4-pro'
WHERE agent_key IN (
  'japanese_language',
  'grammar_reviewer',
  'vocabulary_reviewer',
  'kanji_reviewer',
  'reading_reviewer',
  'listening_reviewer',
  'writing_reviewer',
  'kana_pronunciation_reviewer',
  'example_sentence_reviewer'
);
