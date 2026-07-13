SET search_path TO public;

-- Widen curriculum_practices.practice_type for the Curriculum V2 expansion's lightweight
-- checkpoint/assessment model: reuses the existing practice-taking infrastructure rather than
-- a new entity.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'curriculum_practices_practice_type_check'
  ) THEN
    ALTER TABLE curriculum_practices DROP CONSTRAINT curriculum_practices_practice_type_check;
  END IF;
END $$;

ALTER TABLE curriculum_practices
  ADD CONSTRAINT curriculum_practices_practice_type_check
  CHECK (practice_type IN (
    'writing_canvas','mcq','fill_blank','roleplay','listening','shadowing',
    'module_checkpoint','level_assessment'
  ));
