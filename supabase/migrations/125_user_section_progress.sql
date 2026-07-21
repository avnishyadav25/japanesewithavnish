-- Phase 5 of the public-view overhaul: real per-section lesson/post progress tracking
-- ("2 of 6 sections completed"), not a scroll-position approximation. A "section" is the span
-- of blocks starting at a section_heading block up to (not including) the next one.
-- Generalized across owner types (lesson_blocks vs content_blocks) rather than two near-
-- duplicate tables, matching the section_block_id's polymorphic-but-not-FK modeling already
-- used elsewhere in this schema (e.g. user_learning_progress.content_slug).

SET search_path TO public;

CREATE TABLE IF NOT EXISTS user_section_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('lesson', 'post')),
  owner_id UUID NOT NULL,
  section_block_id UUID NOT NULL,
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'checkpoint_passed')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_email, owner_type, owner_id, section_block_id)
);
CREATE INDEX IF NOT EXISTS idx_user_section_progress_owner ON user_section_progress(user_email, owner_type, owner_id);

COMMENT ON TABLE user_section_progress IS 'Per-user, per-section completion for lessons/posts, keyed by the section_heading block that starts each section. Powers the sticky sidebar "X of Y sections completed" indicator (Phase 6).';
