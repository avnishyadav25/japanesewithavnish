-- Real Practice Test system: named test sets with timed sections and scored questions,
-- replacing the PDF/audio-link-only `practice_test` content type. Modeled on the existing
-- listening_scenarios/listening_questions/listening_attempts pattern (migration 050).

SET search_path TO public;

-- One row per `content_type='practice_test'` post — exam-level settings.
CREATE TABLE IF NOT EXISTS practice_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  passing_score_percent INTEGER NOT NULL DEFAULT 60,
  instructions TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_tests_post ON practice_tests(post_id);

-- Sections within a test, e.g. Vocabulary / Grammar / Reading / Listening — each independently
-- timed to match real JLPT pacing. Reading sections carry a shared passage; listening sections
-- carry a shared audio track (per-question audio_url overrides this when a section has multiple clips).
CREATE TABLE IF NOT EXISTS practice_test_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_test_id UUID NOT NULL REFERENCES practice_tests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'vocabulary' CHECK (section_type IN ('vocabulary', 'grammar', 'reading', 'listening')),
  time_limit_minutes INTEGER,
  passage TEXT,
  audio_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pt_sections_test ON practice_test_sections(practice_test_id);

-- Multiple-choice questions per section. item_type is a free-text JLPT-official-alignment tag
-- (e.g. kanji_reading, orthography, context_meaning, paraphrase, usage, form_selection,
-- sentence_composition, text_grammar, short_passage, mid_passage, long_passage, integrated,
-- information_retrieval, task_based, key_point, general_outline, verbal_expressions,
-- quick_response) — advisory metadata for the admin builder, not DB-enforced.
CREATE TABLE IF NOT EXISTS practice_test_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES practice_test_sections(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  item_type TEXT,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  audio_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pt_questions_section ON practice_test_questions(section_id);

-- User attempts for scoring history and progress tracking.
CREATE TABLE IF NOT EXISTS practice_test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_test_id UUID NOT NULL REFERENCES practice_tests(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  section_scores JSONB,
  answers JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pt_attempts_test ON practice_test_attempts(practice_test_id);
CREATE INDEX IF NOT EXISTS idx_pt_attempts_user ON practice_test_attempts(user_email);

COMMENT ON TABLE practice_tests IS 'Exam-level settings for a content_type=practice_test post';
COMMENT ON TABLE practice_test_sections IS 'Timed sections within a practice test (vocabulary/grammar/reading/listening)';
COMMENT ON TABLE practice_test_questions IS 'Multiple-choice questions per section; options = array of strings, correct_index 0-based';
COMMENT ON TABLE practice_test_attempts IS 'User attempt per practice test: overall + per-section score, timing, answers';
