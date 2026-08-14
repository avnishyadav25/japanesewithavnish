-- Social content packs: full AI-generated pack per blog/product/newsletter (for n8n, manual post, share links)
CREATE TABLE IF NOT EXISTS social_content_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  image_urls JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_packs_entity ON social_content_packs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_social_content_packs_created_at ON social_content_packs(created_at DESC);
