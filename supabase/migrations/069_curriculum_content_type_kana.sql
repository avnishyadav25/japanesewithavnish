SET search_path TO public;

-- Widen curriculum_lessons.content_type to include kana and other lesson types
-- that had no valid option (Hiragana/Katakana lessons were being mistagged, e.g. as 'kanji').
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'curriculum_lessons_content_type_check'
  ) THEN
    ALTER TABLE curriculum_lessons DROP CONSTRAINT curriculum_lessons_content_type_check;
  END IF;
END $$;

ALTER TABLE curriculum_lessons
  ADD CONSTRAINT curriculum_lessons_content_type_check
  CHECK (content_type IN (
    'grammar','vocabulary','kanji','kana','reading','listening','writing','conversation','review','mock_test','mixed'
  ));
