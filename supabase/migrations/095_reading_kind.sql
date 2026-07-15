-- Distinguish genuine reading passages from kana/grammar-in-context lesson drills
-- that were tagged as "reading" content.
ALTER TABLE reading ADD COLUMN IF NOT EXISTS reading_kind TEXT NOT NULL DEFAULT 'passage'
  CHECK (reading_kind IN ('passage', 'lesson_practice'));

UPDATE reading SET reading_kind = 'lesson_practice' WHERE title ILIKE 'Reading practice:%';
