-- curriculum_lessons: optional estimated duration for path "total time"
-- progression_rules: admin-editable rules (stored in site_settings)
SET search_path TO public;

ALTER TABLE curriculum_lessons
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

COMMENT ON COLUMN curriculum_lessons.estimated_minutes IS 'Estimated duration in minutes for learning path total';

-- Default progression rules (admin can override via site_settings)
INSERT INTO site_settings (key, value, updated_at) VALUES
  ('progression_rules', '{"max_reviews_due_before_advance": 20, "min_accuracy_to_unlock_module": 0, "daily_min_kanji": 0, "daily_min_reading": 0}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
