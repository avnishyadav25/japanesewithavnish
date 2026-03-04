-- Comments on learning_content (lessons)
CREATE TABLE IF NOT EXISTS learning_content_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_content_id UUID NOT NULL REFERENCES learning_content(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_content_comments_content_id ON learning_content_comments(learning_content_id);
CREATE INDEX IF NOT EXISTS idx_learning_content_comments_status ON learning_content_comments(status);

ALTER TABLE learning_content_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    CREATE POLICY "Public read approved learning_content_comments" ON learning_content_comments
      FOR SELECT USING (status = 'approved');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY "Public insert learning_content_comments" ON learning_content_comments
      FOR INSERT WITH CHECK (true);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;
