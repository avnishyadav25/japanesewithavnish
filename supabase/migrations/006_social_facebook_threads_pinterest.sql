-- Add Facebook, Threads, Pinterest to social links
INSERT INTO site_settings (key, value) VALUES
  ('facebook_url', '""'),
  ('threads_url', '""'),
  ('pinterest_url', '""')
ON CONFLICT (key) DO NOTHING;
