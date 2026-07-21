SET search_path TO public;

-- Structured content blocks for individual posts (vocabulary/grammar/kanji/reading/
-- listening/writing/conversation/etc.), sibling to lesson_blocks (071/073) which serves
-- the curriculum-lesson layer. Shares the same BlockType registry (src/lib/blocks/blockTypes.ts)
-- and validateBlockData(), but is its own table since posts and curriculum_lessons are
-- different owners with different lifecycles/cascade semantics.
CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  block_data JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  review_status TEXT NOT NULL DEFAULT 'none' CHECK (review_status IN ('none', 'pending', 'approved', 'rejected')),
  generated_by_model TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_post ON content_blocks(post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_blocks_review_status ON content_blocks(review_status) WHERE review_status = 'pending';
