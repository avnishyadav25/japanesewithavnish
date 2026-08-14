-- Optional summary/description for curriculum detail and edit pages; title for exercises
SET search_path TO public;

ALTER TABLE curriculum_levels
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE curriculum_modules
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE curriculum_submodules
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE curriculum_lessons
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE curriculum_lesson_content
  ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN curriculum_lesson_content.title IS 'Optional display label for exercise (fallback: content_slug)';
