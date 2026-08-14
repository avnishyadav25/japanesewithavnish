-- Contextual grammar drills: fill-in particle/conjugation with drag-drop or click.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS grammar_drill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  grammar_id UUID REFERENCES grammar(id) ON DELETE CASCADE,
  sentence_ja TEXT NOT NULL,
  correct_answers JSONB NOT NULL,
  distractors JSONB NOT NULL,
  hint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grammar_drill_lesson ON grammar_drill_items(lesson_id);
CREATE INDEX IF NOT EXISTS idx_grammar_drill_grammar ON grammar_drill_items(grammar_id);

-- Optional: log responses for analytics (Pillar 3).
CREATE TABLE IF NOT EXISTS grammar_drill_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  drill_id UUID NOT NULL REFERENCES grammar_drill_items(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grammar_drill_responses_user ON grammar_drill_responses(user_email);

COMMENT ON TABLE grammar_drill_items IS 'Sentence with gaps; correct_answers = array of strings per gap, distractors = array of wrong options';
COMMENT ON COLUMN grammar_drill_items.sentence_ja IS 'Japanese sentence with __ or similar placeholder for each gap';
