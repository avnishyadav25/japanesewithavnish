-- Ties the sibling projects a `video_per_item` split produces.
--
-- BACKGROUND: `grouping = 'video_per_item'` has been selectable since 134 and never did anything.
-- The wizard promised "10 separate videos", plannedVideoCount() agreed, and createProject() wrote
-- exactly one row — so the option produced a single video covering all ten items, identical to
-- single_video. Splitting for real means one project per item, because video_storyboards is
-- UNIQUE (project_id, narration_lang, version) and cannot hold ten per-item scripts under one
-- project.
--
-- Ten new rows per batch needs a way to see them as one thing, hence this column. Nullable
-- because every project created before now, and every single_video project after, has no batch.
SET search_path TO public;

ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS batch_id UUID;

COMMENT ON COLUMN video_projects.batch_id IS
  'Shared by the sibling projects of one video_per_item split. NULL for a standalone project. Not a foreign key — a batch is a label on a set of peers, with no parent row to point at.';

-- Partial: the overwhelming majority of rows are NULL and would only bloat the index.
CREATE INDEX IF NOT EXISTS idx_video_projects_batch
  ON video_projects (batch_id, created_at) WHERE batch_id IS NOT NULL;
