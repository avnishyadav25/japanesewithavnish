-- Unify learning_content under posts: extend posts, migrate data, update references.
-- Run after app can read from both; drop old tables in a later migration after app switch.

SET search_path TO public;

-- 1.1 Extend posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Backfill existing posts
UPDATE posts SET content_type = 'blog', sort_order = 0, meta = '{}'::jsonb WHERE content_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);
CREATE INDEX IF NOT EXISTS idx_posts_content_type_status ON posts(content_type, status);

-- 1.2 + 1.3 Mapping table and data migration (with slug conflict handling)
CREATE TABLE IF NOT EXISTS learning_content_migration_map (
  old_id UUID PRIMARY KEY,
  old_slug TEXT NOT NULL,
  content_type TEXT NOT NULL,
  new_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  new_slug TEXT NOT NULL
);

-- Migrate learning_content -> posts (only if learning_content exists and has rows)
DO $$
DECLARE
  lc_rec RECORD;
  new_slug TEXT;
  new_id UUID;
  existing_post_slugs TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learning_content') THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(slug) INTO existing_post_slugs FROM posts WHERE slug IS NOT NULL;

  FOR lc_rec IN
    SELECT id, content_type, slug, title, content, jlpt_level, tags, meta, status, sort_order, created_at, updated_at
    FROM learning_content lc
    WHERE NOT EXISTS (SELECT 1 FROM learning_content_migration_map m WHERE m.old_id = lc.id)
  LOOP
    -- Resolve new_slug: use existing slug if not taken, else prefix with content_type
    IF existing_post_slugs IS NULL OR NOT (lc_rec.slug = ANY(existing_post_slugs)) THEN
      new_slug := lc_rec.slug;
    ELSE
      new_slug := lc_rec.slug || '-' || lc_rec.content_type;
    END IF;

    INSERT INTO posts (
      content_type, slug, title, content, summary, jlpt_level, tags,
      og_image_url, status, published_at, sort_order, meta, image_prompt,
      seo_title, seo_description, created_at, updated_at
    ) VALUES (
      lc_rec.content_type,
      new_slug,
      lc_rec.title,
      lc_rec.content,
      (lc_rec.meta->>'summary'),
      CASE WHEN lc_rec.jlpt_level IS NOT NULL AND lc_rec.jlpt_level != '' THEN ARRAY[lc_rec.jlpt_level] ELSE '{}' END,
      COALESCE(lc_rec.tags, '{}'),
      (lc_rec.meta->>'feature_image_url'),
      lc_rec.status,
      CASE WHEN lc_rec.status = 'published' THEN lc_rec.created_at ELSE NULL END,
      COALESCE(lc_rec.sort_order, 0),
      COALESCE(lc_rec.meta, '{}'::jsonb),
      (lc_rec.meta->>'image_prompt'),
      (lc_rec.meta->>'seo_title'),
      (lc_rec.meta->>'seo_description'),
      lc_rec.created_at,
      lc_rec.updated_at
    )
    RETURNING id INTO new_id;

    INSERT INTO learning_content_migration_map (old_id, old_slug, content_type, new_post_id, new_slug)
    VALUES (lc_rec.id, lc_rec.slug, lc_rec.content_type, new_id, new_slug)
    ON CONFLICT (old_id) DO NOTHING;

    existing_post_slugs := array_append(COALESCE(existing_post_slugs, '{}'), new_slug);
  END LOOP;
END;
$$;

-- Migrate comments: learning_content_comments -> post_comments
INSERT INTO post_comments (post_id, author_name, author_email, content, status, created_at)
SELECT m.new_post_id, c.author_name, c.author_email, c.content, c.status, c.created_at
FROM learning_content_comments c
JOIN learning_content_migration_map m ON m.old_id = c.learning_content_id
WHERE NOT EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = m.new_post_id AND pc.author_email = c.author_email AND pc.content = c.content AND pc.created_at = c.created_at);

-- Update user_learning_progress where slug was renamed
UPDATE user_learning_progress ulp
SET content_slug = m.new_slug
FROM learning_content_migration_map m
WHERE ulp.content_slug = m.old_slug AND m.old_slug IS DISTINCT FROM m.new_slug;

-- Update review_schedule where item_id was renamed
UPDATE review_schedule rs
SET item_id = m.new_slug
FROM learning_content_migration_map m
WHERE rs.item_id = m.old_slug AND m.old_slug IS DISTINCT FROM m.new_slug;

-- Update learn_recommended in site_settings: replace old_slug with new_slug in each level array
DO $$
DECLARE
  cur_val JSONB;
  new_val JSONB;
  lvl TEXT;
  arr JSONB;
  elem TEXT;
  out_arr JSONB;
  replaced_slug TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'learn_recommended') THEN
    RETURN;
  END IF;

  SELECT value INTO cur_val FROM site_settings WHERE key = 'learn_recommended' LIMIT 1;
  IF cur_val IS NULL OR cur_val = 'null'::jsonb THEN
    RETURN;
  END IF;

  new_val := cur_val;

  FOR lvl IN SELECT jsonb_object_keys(cur_val)
  LOOP
    arr := cur_val->lvl;
    IF jsonb_typeof(arr) = 'array' THEN
      out_arr := '[]'::jsonb;
      FOR elem IN SELECT jsonb_array_elements_text(arr)
      LOOP
        SELECT m.new_slug INTO replaced_slug FROM learning_content_migration_map m WHERE m.old_slug = elem LIMIT 1;
        IF replaced_slug IS NOT NULL THEN
          out_arr := out_arr || to_jsonb(replaced_slug);
        ELSE
          out_arr := out_arr || to_jsonb(elem);
        END IF;
      END LOOP;
      new_val := jsonb_set(new_val, ARRAY[lvl], out_arr);
    END IF;
  END LOOP;

  UPDATE site_settings SET value = new_val WHERE key = 'learn_recommended';
END;
$$;
