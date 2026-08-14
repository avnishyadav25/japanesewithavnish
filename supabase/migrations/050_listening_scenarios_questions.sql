-- JLPT-style listening comprehension: scenarios and multiple-choice questions.

SET search_path TO public;

-- One scenario = one audio clip with optional transcript. Can link to listening post or stand alone.
CREATE TABLE IF NOT EXISTS listening_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listening_id UUID REFERENCES listening(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listening_scenarios_listening ON listening_scenarios(listening_id);

-- Multiple-choice questions per scenario.
CREATE TABLE IF NOT EXISTS listening_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES listening_scenarios(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listening_questions_scenario ON listening_questions(scenario_id);

-- User attempts for analytics and progress.
CREATE TABLE IF NOT EXISTS listening_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  scenario_id UUID NOT NULL REFERENCES listening_scenarios(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  response_time_ms INTEGER,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listening_attempts_user ON listening_attempts(user_email);
CREATE INDEX IF NOT EXISTS idx_listening_attempts_scenario ON listening_attempts(scenario_id);

COMMENT ON TABLE listening_scenarios IS 'Audio clips for JLPT-style listening comprehension';
COMMENT ON TABLE listening_questions IS 'Multiple-choice questions per scenario; options = array of strings, correct_index 0-based';
COMMENT ON TABLE listening_attempts IS 'User attempt per scenario: score, timing, answers';
