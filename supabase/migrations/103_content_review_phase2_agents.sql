-- Content Review Center Phase 2 (per the founder's own spec section 23's Phase 2 list):
-- dedicated Grammar/Vocabulary/Kanji/Reading/Listening reviewers, replacing the generic
-- content_type_specialist for those 5 types with deeper, type-specific rubrics.
-- Quality score, bulk review, and review dashboard (also listed under that Phase 2) were
-- already built in Phase 1.
SET search_path TO public;

INSERT INTO content_review_agents
  (agent_key, name, description, scope, prompt_key, is_deterministic, sort_order)
VALUES
  (
    'grammar_reviewer',
    'Grammar Reviewer',
    'Pattern, meaning, formation, register, nuance, restrictions, natural examples, common mistakes, comparison with similar grammar. Detects oversimplified absolute claims (e.g. "X = casual, Y = formal").',
    '{grammar}',
    'content_review_grammar_reviewer',
    false,
    45
  ),
  (
    'vocabulary_reviewer',
    'Vocabulary Reviewer',
    'Canonical form, reading, romaji, meaning, part of speech, transitivity, natural usage, duplicates. Detects grammar patterns or kana stored as vocabulary, and rare dictionary meanings presented as primary.',
    '{vocabulary}',
    'content_review_vocabulary_reviewer',
    false,
    46
  ),
  (
    'kanji_reviewer',
    'Kanji Reviewer',
    'Single character vs. compound, primary meaning, priority on/kun readings, stroke data, common compounds, level suitability. Blocks compounds miscounted as one kanji and rare meanings shown before common ones.',
    '{kanji}',
    'content_review_kanji_reviewer',
    false,
    47
  ),
  (
    'reading_reviewer',
    'Reading Reviewer',
    'Passage accuracy, naturalness, level suitability, vocabulary/grammar load, question support, answer support, translation consistency, names/dates/times/locations/facts cross-checked against the passage.',
    '{reading}',
    'content_review_reading_reviewer',
    false,
    48
  ),
  (
    'listening_reviewer',
    'Listening Reviewer',
    'Audio existence, transcript, reading support, translation, questions, correct answers, explanations, scenario consistency. Complements practice_answer''s deterministic completeness check with qualitative review.',
    '{listening}',
    'content_review_listening_reviewer',
    false,
    49
  )
ON CONFLICT (agent_key) DO NOTHING;

-- Narrow content_type_specialist now that grammar/vocabulary/kanji/reading/listening each
-- have their own dedicated agent — it now only covers writing/sounds, the two types with
-- no dedicated agent in the founder's spec and the sparsest structured data.
UPDATE content_review_agents SET scope = '{writing,sounds}' WHERE agent_key = 'content_type_specialist';
