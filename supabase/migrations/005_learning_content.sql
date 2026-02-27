-- Learning content (grammar, vocabulary, kanji, reading, writing)
CREATE TABLE IF NOT EXISTS learning_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  jlpt_level TEXT,
  tags TEXT[],
  meta JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_content_type ON learning_content(content_type);
CREATE INDEX IF NOT EXISTS idx_learning_content_jlpt ON learning_content(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_learning_content_status ON learning_content(status);

ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;

-- Public read for published content
CREATE POLICY "Public read published learning_content" ON learning_content
  FOR SELECT USING (status = 'published');
