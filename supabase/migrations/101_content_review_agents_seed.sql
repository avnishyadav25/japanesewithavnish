-- Seed the Phase 1 review agent registry (six agents, per the founder's own spec section 24:
-- "start with only these six"). scope='{}' means the agent runs for all 7 in-scope content
-- types; practice_answer is explicitly scoped to grammar/listening only, since no
-- practice/quiz table exists for vocabulary/kanji/reading/writing/sounds today.
SET search_path TO public;

INSERT INTO content_review_agents
  (agent_key, name, description, scope, prompt_key, is_deterministic, sort_order)
VALUES
  (
    'metadata_taxonomy',
    'Metadata & Taxonomy Reviewer',
    'Checks required fields, duplicate detection, sidecar-row presence, and JLPT-level/content-type consistency. Mostly deterministic; a small LLM pass checks whether title/summary/tags plausibly match the declared level and type.',
    '{}',
    'content_review_metadata_taxonomy',
    false,
    10
  ),
  (
    'japanese_language',
    'Japanese Language Accuracy Reviewer',
    'Checks grammar, particles, readings, meanings, and translation accuracy in the reviewed content. The highest-priority specialist for this codebase''s content.',
    '{}',
    'content_review_japanese_language',
    false,
    20
  ),
  (
    'level_alignment',
    'Level & Content-Type Alignment Reviewer',
    'Checks whether the content''s actual difficulty matches its declared JLPT level and content type. Scoped to posts-level signals only (no curriculum_lessons access in Phase 1).',
    '{}',
    'content_review_level_alignment',
    false,
    30
  ),
  (
    'practice_answer',
    'Practice & Answer Reviewer',
    'Deterministic-only in Phase 1: validates grammar_drill_items and listening_questions structure (correct-answer bounds, no answer/distractor overlap, gap placeholder present). No-op for vocabulary/kanji/reading/writing/sounds, which have no practice table today.',
    '{grammar,listening}',
    'content_review_practice_answer',
    true,
    40
  ),
  (
    'content_type_specialist',
    'Content-Type Specialist Reviewer',
    'One prompt parameterized by content_type, covering vocabulary/grammar/kanji/reading/listening/writing/sounds-specific quality checks.',
    '{}',
    'content_review_content_type_specialist',
    false,
    50
  ),
  (
    'final_aggregator',
    'Final Review Aggregator',
    'Combines the other agents'' findings for a run, computes the overall score and category rollup, and writes a short prose summary.',
    '{}',
    'content_review_final_aggregator',
    false,
    60
  )
ON CONFLICT (agent_key) DO NOTHING;
