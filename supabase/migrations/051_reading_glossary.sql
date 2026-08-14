-- Tap-for-definition glossary for reading sandbox (N2/N1 long-form).

SET search_path TO public;

CREATE TABLE IF NOT EXISTS reading_glossary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  segment_text TEXT NOT NULL,
  segment_start INTEGER NOT NULL,
  segment_end INTEGER NOT NULL,
  definition_text TEXT,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE SET NULL,
  grammar_id UUID REFERENCES grammar(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_glossary_post ON reading_glossary(post_id);

COMMENT ON TABLE reading_glossary IS 'Tappable segments in reading content with definition or link to vocab/grammar';
