-- Feature image URL for level, module, submodule, lesson (shown in circle on admin + public curriculum)
SET search_path TO public;

ALTER TABLE curriculum_levels
  ADD COLUMN IF NOT EXISTS feature_image_url TEXT;

ALTER TABLE curriculum_modules
  ADD COLUMN IF NOT EXISTS feature_image_url TEXT;

ALTER TABLE curriculum_submodules
  ADD COLUMN IF NOT EXISTS feature_image_url TEXT;

ALTER TABLE curriculum_lessons
  ADD COLUMN IF NOT EXISTS feature_image_url TEXT;

COMMENT ON COLUMN curriculum_levels.feature_image_url IS 'Optional image URL for level (shown in curriculum browser)';
COMMENT ON COLUMN curriculum_modules.feature_image_url IS 'Optional image URL for module (shown in curriculum browser)';
COMMENT ON COLUMN curriculum_submodules.feature_image_url IS 'Optional image URL for submodule (shown in curriculum browser)';
COMMENT ON COLUMN curriculum_lessons.feature_image_url IS 'Optional image URL for lesson (shown in curriculum browser)';
