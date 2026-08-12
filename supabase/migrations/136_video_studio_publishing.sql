-- Video Studio: distribution — where a finished render goes.
--
-- Uploads run on the WORKER, never in a Netlify route: a 10-minute 1080p MP4 is 100-200MB and
-- a resumable YouTube upload cannot complete inside a ~10s function. The app only ever writes
-- intent rows here; the worker reconciles them.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS video_publish_targets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind         TEXT NOT NULL CHECK (kind IN ('site', 'youtube', 'instagram', 'tiktok')),
  label        TEXT NOT NULL,
  -- OAuth refresh tokens / long-lived page tokens. NEVER select this column into an API
  -- response — admin routes must enumerate columns explicitly rather than SELECT *.
  credentials  JSONB,
  -- Non-secret per-channel settings: default privacy, playlist id, IG user id, hashtags.
  config       JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_publications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  render_id      UUID NOT NULL REFERENCES video_renders(id) ON DELETE CASCADE,
  target_id      UUID NOT NULL REFERENCES video_publish_targets(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'uploading', 'published', 'failed', 'removed')),
  external_id    TEXT,
  external_url   TEXT,
  title          TEXT,
  description    TEXT,
  tags           TEXT[],
  scheduled_for  TIMESTAMPTZ,
  attempt_count  INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (render_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_video_publications_pending
  ON video_publications (created_at ASC) WHERE status IN ('queued', 'uploading');

-- On-site embedding. A link table rather than a column on posts/curriculum_lessons so one page
-- can carry several videos (a 60s short AND a full walkthrough) without altering two large
-- existing tables, and so unlinking never touches content rows.
CREATE TABLE IF NOT EXISTS video_content_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  render_id     UUID NOT NULL REFERENCES video_renders(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  lesson_id     UUID REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  placement     TEXT NOT NULL DEFAULT 'inline'
                  CHECK (placement IN ('hero', 'inline', 'sidebar', 'footer')),
  sort_order    INT NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (post_id IS NOT NULL OR lesson_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_video_content_links_post
  ON video_content_links (post_id, sort_order) WHERE post_id IS NOT NULL AND is_published;
CREATE INDEX IF NOT EXISTS idx_video_content_links_lesson
  ON video_content_links (lesson_id, sort_order) WHERE lesson_id IS NOT NULL AND is_published;

-- The site target always exists — embedding on our own pages needs no credentials.
INSERT INTO video_publish_targets (kind, label, config)
SELECT 'site', 'JapaneseWithAvnish (on-site embed)', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM video_publish_targets WHERE kind = 'site');
