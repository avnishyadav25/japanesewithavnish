-- Adds slug (for per-section public routes) and feature_image_url (for AI-generated
-- header images) to platform_guide_sections, bringing Site Guide up to parity with
-- the Blog/Curriculum content model.
ALTER TABLE platform_guide_sections
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS feature_image_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_guide_sections_slug
  ON platform_guide_sections (slug) WHERE slug IS NOT NULL;

-- Backfill slugs for existing rows from their titles.
UPDATE platform_guide_sections
SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;
