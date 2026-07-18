-- Typed lesson-join tables for reading/listening/writing/practice_test, mirroring the existing
-- curriculum_lesson_vocabulary/_grammar/_kanji pattern (migration 042) — Phase 5 of the admin
-- content-editor overhaul. Each references the sidecar table's own id (not post_id), same as
-- the vocabulary/grammar/kanji links.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS curriculum_lesson_reading (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  reading_id UUID NOT NULL REFERENCES reading(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, reading_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_reading_lesson ON curriculum_lesson_reading(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_reading_reading ON curriculum_lesson_reading(reading_id);

CREATE TABLE IF NOT EXISTS curriculum_lesson_listening (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  listening_id UUID NOT NULL REFERENCES listening(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, listening_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_listening_lesson ON curriculum_lesson_listening(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_listening_listening ON curriculum_lesson_listening(listening_id);

CREATE TABLE IF NOT EXISTS curriculum_lesson_writing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  writing_id UUID NOT NULL REFERENCES writing(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, writing_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_writing_lesson ON curriculum_lesson_writing(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_writing_writing ON curriculum_lesson_writing(writing_id);

CREATE TABLE IF NOT EXISTS curriculum_lesson_practice_test (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  practice_test_id UUID NOT NULL REFERENCES practice_tests(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, practice_test_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_practice_test_lesson ON curriculum_lesson_practice_test(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_practice_test_pt ON curriculum_lesson_practice_test(practice_test_id);

COMMENT ON TABLE curriculum_lesson_reading IS 'Lesson-to-reading-post many-to-many links, mirrors curriculum_lesson_vocabulary';
COMMENT ON TABLE curriculum_lesson_listening IS 'Lesson-to-listening-post many-to-many links, mirrors curriculum_lesson_vocabulary';
COMMENT ON TABLE curriculum_lesson_writing IS 'Lesson-to-writing-post many-to-many links, mirrors curriculum_lesson_vocabulary';
COMMENT ON TABLE curriculum_lesson_practice_test IS 'Lesson-to-practice-test many-to-many links, mirrors curriculum_lesson_vocabulary';
