-- Learn recommended lessons per level (curated in admin)
-- Format: { "all": ["slug1","slug2",...], "n5": [...], "n4": [...], ... }
INSERT INTO site_settings (key, value) VALUES
  ('learn_recommended', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
