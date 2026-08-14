-- Archive legacy learning_content tables (do not drop); data also lives in posts.
-- Run only after migration 038 has been applied and app uses posts for learn content.

SET search_path TO public;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learning_content_comments') THEN
    ALTER TABLE learning_content_comments RENAME TO learning_content_comments_archive;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learning_content') THEN
    ALTER TABLE learning_content RENAME TO learning_content_archive;
  END IF;
END
$$;
