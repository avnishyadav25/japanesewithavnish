-- Phase 1 of the admin content-editor overhaul: promote grammar meaning/when-to-use
-- out of posts.meta into real columns, and let examples attach to kanji (previously
-- only vocabulary/grammar could own an example row).
SET search_path TO public;

ALTER TABLE grammar ADD COLUMN IF NOT EXISTS meaning TEXT;
ALTER TABLE grammar ADD COLUMN IF NOT EXISTS when_to_use TEXT;

ALTER TABLE examples ADD COLUMN IF NOT EXISTS kanji_id UUID REFERENCES kanji(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_examples_kanji ON examples(kanji_id);

-- Backfill grammar.meaning from posts.meta->>'meaning' where the generic editor
-- already collected it (LearningContentForm's grammar block writes meta.meaning).
UPDATE grammar g
SET meaning = p.meta->>'meaning'
FROM posts p
WHERE p.id = g.post_id
  AND g.meaning IS NULL
  AND p.meta->>'meaning' IS NOT NULL
  AND trim(p.meta->>'meaning') <> '';
