-- Attach a finished video to a module or submodule, not only a lesson.
--
-- `video_content_links` has had `post_id` and `lesson_id` since migration 136, with the intent
-- stated in its own header: a link table rather than a column on posts, so one page can carry
-- several videos. The curriculum has four tiers, and a video generated from a module- or
-- level-scope covers many lessons — attaching it to one of them is wrong, and attaching it to all
-- of them is noise.
--
-- Nullable and additive: every existing row is a post or lesson link and stays exactly as it is.
ALTER TABLE video_content_links
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS submodule_id UUID REFERENCES curriculum_submodules(id) ON DELETE CASCADE;

-- Same shape as the lesson and post indexes added in migration 147: partial, so the NULLs that
-- every other kind of link carries do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_content_links_render_module
  ON video_content_links (render_id, module_id) WHERE module_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_content_links_render_submodule
  ON video_content_links (render_id, submodule_id) WHERE submodule_id IS NOT NULL;

-- The original CHECK required a post or a lesson. Widen it rather than drop it: a link pointing at
-- nothing is the one state that must stay impossible, because it would render nowhere and be
-- invisible to every reader.
ALTER TABLE video_content_links DROP CONSTRAINT IF EXISTS video_content_links_check;
ALTER TABLE video_content_links
  ADD CONSTRAINT video_content_links_target_check
  CHECK (post_id IS NOT NULL OR lesson_id IS NOT NULL OR module_id IS NOT NULL OR submodule_id IS NOT NULL);
