-- Video Studio (Phase 0/1): turns curriculum + learn-library content into AI-narrated videos.
--
-- Architecture note: Netlify functions cap out around 10s and have neither ffmpeg nor a
-- browser, so rendering CANNOT happen in an API route (see the long-standing bug in
-- src/app/api/ai/create-reel-video/route.ts, which spawns a system ffmpeg and only ever
-- works on a developer machine). These tables are therefore a control plane: the admin panel
-- writes rows here, and a portable worker CLI (scripts/video-worker.ts) running on a Mac or
-- in GitHub Actions claims render jobs and does the actual work.
--
-- Queue note: video_render_jobs deliberately copies the FOR UPDATE SKIP LOCKED claim from
-- content_review_jobs (migration 100) but reclaims stale work off heartbeat_at rather than
-- claimed_at. content_review_jobs' STALE_CLAIM_MINUTES = 10 measured from claim time is fine
-- for a job that is a handful of LLM calls; a 1080p render legitimately runs 20-40 minutes and
-- would be reclaimed mid-flight by that rule, producing duplicate renders forever.
--
-- Naming note: everything is prefixed video_ to stay clear of the existing `media` table
-- (migration 001, largely vestigial) and the `reels/` R2 prefix used by create-reel-video.
SET search_path TO public;

-- ---------------------------------------------------------------------------
-- Presentation assets referenced by projects (created first for the FKs below)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_themes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key               TEXT NOT NULL UNIQUE,
  label             TEXT NOT NULL,
  description       TEXT,
  -- Colors/typography/spacing consumed by src/remotion/theme.ts. Mirrors tailwind.config.ts
  -- for the default theme so videos look like the site.
  tokens            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { "en": "en-US-Neural2-F", "hi": "hi-IN-Neural2-A", "ja": "ja-JP-Neural2-B" }
  default_voices    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled        BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_bgm_tracks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT NOT NULL,
  audio_url           TEXT NOT NULL,
  duration_seconds    NUMERIC(8,3),
  mood                TEXT,
  -- license/attribution are NOT optional metadata: a copyright claim on a royalty-free-looking
  -- track can take down the whole YouTube channel, so provenance is recorded per track.
  license             TEXT NOT NULL,
  attribution         TEXT,
  source_url          TEXT,
  loop_point_seconds  NUMERIC(8,3),
  default_gain_db     NUMERIC(5,2) NOT NULL DEFAULT -18,
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Projects, storyboards, jobs, renders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_projects (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                    TEXT NOT NULL,
  scope_kind               TEXT NOT NULL
                             CHECK (scope_kind IN ('curriculum_level', 'curriculum_module',
                               'curriculum_submodule', 'curriculum_lesson', 'content_batch',
                               'content_item')),
  -- Shape depends on scope_kind:
  --   curriculum_*   { "levelId" | "moduleId" | "submoduleId" | "lessonId": uuid }
  --   content_batch  { "contentType", "jlptLevel", "tags": [], "limit": n, "postIds": [] }
  --   content_item   { "postId": uuid }
  scope_ref                JSONB NOT NULL,
  -- "10 vocab words in one video" vs "one video per word" — both were asked for.
  grouping                 TEXT NOT NULL DEFAULT 'single_video'
                             CHECK (grouping IN ('single_video', 'video_per_item')),
  theme_key                TEXT NOT NULL DEFAULT 'washi-light' REFERENCES video_themes(key) ON UPDATE CASCADE,
  bgm_track_id             UUID REFERENCES video_bgm_tracks(id) ON DELETE SET NULL,
  narration_langs          TEXT[] NOT NULL DEFAULT '{en}',
  formats                  TEXT[] NOT NULL DEFAULT '{vertical}',
  target_duration_seconds  INT,
  tone                     TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'generating_script', 'script_ready',
                               'script_pending_review', 'queued_render', 'rendering',
                               'render_ready', 'video_pending_review', 'publishing',
                               'published', 'failed', 'rejected', 'archived')),
  -- Denormalised pointer to the storyboard the UI should open by default. Nullable and set
  -- after the first generation; FK added below once video_storyboards exists.
  current_storyboard_id    UUID,
  error_message            TEXT,
  created_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_storyboards (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id             UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  version                INT NOT NULL,
  narration_lang         TEXT NOT NULL CHECK (narration_lang IN ('en', 'hi', 'ja')),
  parent_storyboard_id   UUID REFERENCES video_storyboards(id) ON DELETE SET NULL,
  source                 TEXT NOT NULL
                           CHECK (source IN ('ai_generated', 'human_edited', 'regenerated', 'imported')),
  -- The whole storyboard document (see src/lib/video/types.ts). Scenes live INSIDE this JSONB
  -- rather than in a video_scenes table on purpose: the editor loads and saves the document
  -- atomically, nothing ever queries a single scene, and a row-per-scene table would add
  -- sort-order reconciliation plus partial-save races for no query benefit. TTS caching is
  -- keyed by content hash (video_tts_assets, migration 135), so it survives reordering.
  doc                    JSONB NOT NULL,
  -- Lets the UI say "the source content changed since this script was written".
  content_snapshot       JSONB,
  content_checksum       TEXT,
  approval_status        TEXT NOT NULL DEFAULT 'draft'
                           CHECK (approval_status IN ('draft', 'pending_review', 'approved',
                             'rejected', 'superseded')),
  approved_by            TEXT,
  approved_at            TIMESTAMPTZ,
  rejection_reason       TEXT,
  llm_model              TEXT,
  prompt_key             TEXT,
  prompt_tokens          INT,
  completion_tokens      INT,
  estimated_cost_usd     NUMERIC(10,6),
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, narration_lang, version)
);

ALTER TABLE video_projects
  DROP CONSTRAINT IF EXISTS video_projects_current_storyboard_id_fkey;
ALTER TABLE video_projects
  ADD CONSTRAINT video_projects_current_storyboard_id_fkey
  FOREIGN KEY (current_storyboard_id) REFERENCES video_storyboards(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS video_render_jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  storyboard_id     UUID NOT NULL REFERENCES video_storyboards(id) ON DELETE CASCADE,
  format            TEXT NOT NULL CHECK (format IN ('vertical', 'landscape', 'square', 'embed')),
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'claimed', 'running', 'completed', 'failed', 'cancelled')),
  stage             TEXT CHECK (stage IN ('tts', 'broll', 'timeline', 'render', 'post', 'upload', 'publish')),
  progress_pct      INT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  -- One short human-readable line per completed stage, rendered in the admin job monitor.
  log               JSONB NOT NULL DEFAULT '[]'::jsonb,
  runner            TEXT CHECK (runner IN ('local', 'github-actions')),
  runner_id         TEXT,
  priority          INT NOT NULL DEFAULT 100,
  attempt_count     INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 3,
  error_message     TEXT,
  requested_by      TEXT,
  claimed_at        TIMESTAMPTZ,
  -- The worker refreshes this every 30s. Stale reclaim keys on THIS, not claimed_at.
  heartbeat_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_video_render_jobs_queued
  ON video_render_jobs (priority ASC, created_at ASC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_video_render_jobs_inflight
  ON video_render_jobs (heartbeat_at) WHERE status IN ('claimed', 'running');
CREATE INDEX IF NOT EXISTS idx_video_render_jobs_project ON video_render_jobs (project_id, created_at DESC);
-- One in-flight job per (storyboard, format): double-clicking "Render" must not queue twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_render_jobs_one_active
  ON video_render_jobs (storyboard_id, format) WHERE status IN ('queued', 'claimed', 'running');

CREATE TABLE IF NOT EXISTS video_renders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID REFERENCES video_render_jobs(id) ON DELETE SET NULL,
  project_id        UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  storyboard_id     UUID NOT NULL REFERENCES video_storyboards(id) ON DELETE CASCADE,
  format            TEXT NOT NULL CHECK (format IN ('vertical', 'landscape', 'square', 'embed')),
  narration_lang    TEXT NOT NULL CHECK (narration_lang IN ('en', 'hi', 'ja')),
  video_url         TEXT NOT NULL,
  poster_url        TEXT,
  srt_url           TEXT,
  vtt_url           TEXT,
  -- Zip of per-scene MP4s + narration WAVs + captions.srt + an FCPXML timeline, for finishing
  -- in DaVinci/Premiere when a video matters enough.
  bundle_url        TEXT,
  duration_seconds  NUMERIC(8,2),
  width             INT,
  height            INT,
  fps               INT,
  file_size_bytes   BIGINT,
  render_seconds    NUMERIC(8,2),
  approval_status   TEXT NOT NULL DEFAULT 'not_required'
                      CHECK (approval_status IN ('not_required', 'pending_review', 'approved', 'rejected')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  -- A re-render supersedes rather than replaces: old MP4s stay in R2 so published links
  -- never 404 mid-swap.
  is_current        BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_renders_current
  ON video_renders (project_id, format, narration_lang) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_video_renders_project ON video_renders (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_renders_pending_review
  ON video_renders (created_at DESC) WHERE approval_status = 'pending_review';

-- ---------------------------------------------------------------------------
-- Seed the default theme so video_projects.theme_key's FK is satisfiable on day one.
-- Tokens mirror tailwind.config.ts, so generated video looks like the site.
-- ---------------------------------------------------------------------------

INSERT INTO video_themes (key, label, description, tokens, default_voices, sort_order)
VALUES
  ('washi-light', 'Washi (light)', 'Site palette on a warm paper background — the default.',
   '{"bg":"#FAF8F5","surface":"#FFFFFF","primary":"#D0021B","primaryHover":"#A00016","accent":"#C8A35F","text":"#1A1A1A","textMuted":"#555555","textSubtle":"#888888","border":"#f0ece6","radius":20,"fontSans":"DM Sans","fontSerif":"DM Serif Display","fontJa":"Noto Sans JP"}'::jsonb,
   '{"en":"en-US-Neural2-F","hi":"hi-IN-Neural2-A","ja":"ja-JP-Neural2-B"}'::jsonb, 10),
  ('sumi-dark', 'Sumi (dark)', 'High-contrast dark ink theme — reads well on phones at night.',
   '{"bg":"#111111","surface":"#1E1E1E","primary":"#FF3B4E","primaryHover":"#D0021B","accent":"#C8A35F","text":"#FAF8F5","textMuted":"#B4B0AA","textSubtle":"#807C76","border":"#2C2C2C","radius":20,"fontSans":"DM Sans","fontSerif":"DM Serif Display","fontJa":"Noto Sans JP"}'::jsonb,
   '{"en":"en-US-Neural2-F","hi":"hi-IN-Neural2-A","ja":"ja-JP-Neural2-B"}'::jsonb, 20),
  ('neon-study', 'Neon study', 'Saturated high-energy look for Shorts/Reels.',
   '{"bg":"#0B0F1A","surface":"#151C2E","primary":"#FF2D78","primaryHover":"#D91663","accent":"#3DDC97","text":"#FFFFFF","textMuted":"#A9B4CC","textSubtle":"#6B7794","border":"#222C45","radius":24,"fontSans":"DM Sans","fontSerif":"DM Serif Display","fontJa":"Noto Sans JP"}'::jsonb,
   '{"en":"en-US-Neural2-F","hi":"hi-IN-Neural2-A","ja":"ja-JP-Neural2-C"}'::jsonb, 30)
ON CONFLICT (key) DO NOTHING;
