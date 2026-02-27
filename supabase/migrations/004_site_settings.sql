-- Site settings (key-value for company, contact, SEO, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default keys
INSERT INTO site_settings (key, value) VALUES
  ('company_name', '"Japanese with Avnish"'),
  ('company_tagline', '""'),
  ('logo_url', '""'),
  ('favicon_url', '""'),
  ('support_email', '""'),
  ('contact_email', '""'),
  ('phone', '""'),
  ('twitter_url', '""'),
  ('instagram_url', '""'),
  ('youtube_url', '""'),
  ('discord_url', '""'),
  ('seo_default_title', '""'),
  ('seo_default_description', '""'),
  ('seo_default_og_image', '""'),
  ('footer_copyright', '""'),
  ('footer_links', '[]')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (admin uses service key)
