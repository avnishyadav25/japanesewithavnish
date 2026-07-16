-- Distinguishes genuine editorial blog content from curriculum/reference records
-- (grammar, vocabulary, kanji, reading, writing, listening, sounds, study_guide),
-- which have their own /learn/* library pages and should not appear in the
-- editorial /blog feed even though some previously shared content_type='blog'-like
-- treatment there.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_surface TEXT
  CHECK (content_surface IN ('curriculum_only', 'learn_library', 'blog_editorial', 'both'));

UPDATE posts SET content_surface = CASE WHEN content_type = 'blog' THEN 'blog_editorial' ELSE 'learn_library' END
WHERE content_surface IS NULL;

ALTER TABLE posts ALTER COLUMN content_surface SET DEFAULT 'learn_library';
