SET search_path TO public;

-- Reproduces scripts/migrate-curriculum-schema.ts as a tracked migration, so a fresh DB
-- provisioned from supabase/migrations alone ends up with the same schema this project has
-- had in practice since that ad-hoc script was run by hand. Idempotent against the current DB.
-- (content_type's CHECK constraint is owned by migration 069, not repeated here.)

ALTER TABLE curriculum_lessons
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS access_type  TEXT NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS content_type TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'curriculum_lessons_access_type_check'
  ) THEN
    ALTER TABLE curriculum_lessons
      ADD CONSTRAINT curriculum_lessons_access_type_check
      CHECK (access_type IN ('free', 'premium'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS curriculum_practices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  practice_type     TEXT,
  content_data      JSONB,
  sort_order        INT NOT NULL DEFAULT 0,
  estimated_minutes INT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'curriculum_practices_practice_type_check'
  ) THEN
    ALTER TABLE curriculum_practices
      ADD CONSTRAINT curriculum_practices_practice_type_check
      CHECK (practice_type IN (
        'writing_canvas','mcq','fill_blank','roleplay','listening','shadowing'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS curriculum_practices_lesson_idx
  ON curriculum_practices(lesson_id);
