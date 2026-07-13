-- Platform Guide: admin-configurable sections explaining the site's major features
-- (curriculum, blog, kanji, vocab, Nihongo Navi, etc.) to students on a public /guide page.
CREATE TABLE IF NOT EXISTS platform_guide_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  link_href TEXT,
  link_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_guide_sections_sort ON platform_guide_sections (sort_order, created_at);
