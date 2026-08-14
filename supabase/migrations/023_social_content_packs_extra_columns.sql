-- Store full content source info and optional reference image for social packs
ALTER TABLE social_content_packs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

COMMENT ON COLUMN social_content_packs.description IS 'Source description used when generating the pack (blog/product/newsletter)';
COMMENT ON COLUMN social_content_packs.summary IS 'Source summary used when generating the pack';
COMMENT ON COLUMN social_content_packs.link IS 'Source link (e.g. blog/product URL)';
COMMENT ON COLUMN social_content_packs.reference_image_url IS 'Optional reference image URL for japani-style image generation';
