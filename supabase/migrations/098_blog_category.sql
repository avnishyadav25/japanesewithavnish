-- Editorial category for genuine blog posts, distinct from content_type (which
-- also covers curriculum/reference records). Lets the blog filter bar filter by
-- editorial topic instead of the largely-uniform content_type='blog'.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS blog_category TEXT;
