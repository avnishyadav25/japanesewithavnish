-- JLPT pinned posts per level (curated in admin)
-- Format: { "n5": ["slug1","slug2","slug3"], "n4": [...], ... }
INSERT INTO site_settings (key, value) VALUES
  ('jlpt_pinned_posts', '{}')
ON CONFLICT (key) DO NOTHING;
