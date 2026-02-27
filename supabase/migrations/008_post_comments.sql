-- Add name to subscribers (for comment/footer signups)
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS name TEXT;

-- Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_status ON post_comments(status);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Public read approved comments
CREATE POLICY "Public read approved post_comments" ON post_comments
  FOR SELECT USING (status = 'approved');

-- Public insert (anyone can submit a comment)
CREATE POLICY "Public insert post_comments" ON post_comments
  FOR INSERT WITH CHECK (true);

-- RLS: UPDATE/DELETE handled by service role (admin API)
