-- Video Studio round 2: caption style, per-project branding, topic scopes, link dedupe.
--
-- FOUR UNRELATED CHANGES IN ONE FILE, deliberately: they are all one branch's worth of schema and
-- splitting them into four migrations would make the numeric-prefix collision check in
-- scripts/migrate.ts harder to reason about for no benefit. Each block below says why it exists.
SET search_path TO public;

-- 1. Caption style ----------------------------------------------------------
--
-- Captions were hardcoded per aspect ratio: `scale.caption * 1.05`, i.e. 42px burned into a
-- 1080x1920 frame at 94% width. On a vocabulary scene the pill covered the example sentence it
-- was reading out, which is the one thing the viewer needed to see.
--
-- This follows the `pacing`/`voices` precedent from 140 rather than introducing a generic
-- settings blob: a typed column is greppable and a generic one becomes a junk drawer.
--
-- Read at RENDER time, not generation time (see scripts/lib/video/db.ts, which already joins the
-- project for bgm_track_id). That makes caption style a re-cut rather than a regenerate — TTS is
-- cached by content hash, so changing the subtitle size costs render minutes and no LLM spend.
ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS captions JSONB,
  ADD COLUMN IF NOT EXISTS branding JSONB;

COMMENT ON COLUMN video_projects.captions IS
  'CaptionSettings (src/lib/video/types.ts): enabled, burnIn, style, scale, position, opacity, maxWidthPct. NULL = DEFAULT_CAPTIONS.';
COMMENT ON COLUMN video_projects.branding IS
  'BrandingSettings (src/lib/video/types.ts): logo, logoOpacity, hashtag, handle, socials, mascots, mascot. NULL = DEFAULT_BRANDING.';

-- 2. Topic scope ------------------------------------------------------------
--
-- A "birds in Japanese" video has no curriculum node and no single content_type, so none of the
-- six existing scope kinds fit. scope_ref carries { topic, postIds[] } — the topic for the title
-- and the prompt, the postIds for what actually gets taught, resolved through the same
-- queryPosts() path content_batch already uses.
--
-- Dropping and re-adding rather than ALTER ... ADD CONSTRAINT: Postgres has no "extend a CHECK"
-- and the constraint is unnamed in 134, so it carries the generated name below.
ALTER TABLE video_projects
  DROP CONSTRAINT IF EXISTS video_projects_scope_kind_check;

ALTER TABLE video_projects
  ADD CONSTRAINT video_projects_scope_kind_check CHECK (scope_kind IN (
    'curriculum_level', 'curriculum_module', 'curriculum_submodule', 'curriculum_lesson',
    'content_batch', 'content_item', 'topic'
  ));

-- 3. Publish-to-site dedupe -------------------------------------------------
--
-- 136 created video_content_links with no unique constraint, and the insert in
-- api/admin/video/renders/[id]/link is a bare INSERT. Clicking "Publish to site" twice embedded
-- the same video on the same page twice. Partial indexes because the table allows either a
-- post_id or a lesson_id (its own CHECK), so neither column is NOT NULL and a plain composite
-- unique index would let NULLs slip past.
--
-- Deduping existing rows first: an index build fails outright on duplicates, which would abort
-- the whole migration. Keeps the oldest of each group.
DELETE FROM video_content_links a
USING video_content_links b
WHERE a.id > b.id
  AND a.render_id = b.render_id
  AND a.post_id IS NOT NULL AND a.post_id = b.post_id;

DELETE FROM video_content_links a
USING video_content_links b
WHERE a.id > b.id
  AND a.render_id = b.render_id
  AND a.lesson_id IS NOT NULL AND a.lesson_id = b.lesson_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_content_links_render_post
  ON video_content_links (render_id, post_id) WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_content_links_render_lesson
  ON video_content_links (render_id, lesson_id) WHERE lesson_id IS NOT NULL;
