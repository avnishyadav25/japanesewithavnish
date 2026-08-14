-- Video Studio: full audit trail — every prompt, every reply, every in-progress edit, every asset.
--
-- The storyboard table records what a script ENDED UP as. While tuning prompts and pacing the
-- useful question is the other one: what exactly was sent, and what came back? Token counts alone
-- cannot answer "why did that run come out better than this one".
SET search_path TO public;

-- ---------------------------------------------------------------------------
-- Every LLM call, reproducible
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_generation_runs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id              UUID REFERENCES video_projects(id) ON DELETE CASCADE,
  -- Set once the run produces a storyboard. NULL while in flight, or if the call failed.
  storyboard_id           UUID REFERENCES video_storyboards(id) ON DELETE SET NULL,
  kind                    TEXT NOT NULL DEFAULT 'full_script'
                            CHECK (kind IN ('full_script', 'scene_regenerate', 'auto_short', 'metadata')),
  narration_lang          TEXT,
  model                   TEXT NOT NULL,
  prompt_key              TEXT,
  -- The exact strings sent. Stored verbatim, including any per-run edits made in the prompt
  -- preview panel, so a good result can be reproduced and a bad one diagnosed.
  system_prompt           TEXT NOT NULL,
  user_message            TEXT NOT NULL,
  raw_response            TEXT,
  -- The slot definitions (id, hint, computed word budget) handed to the model this run.
  slots                   JSONB,
  -- PacingConfig in force, so a duration miss can be traced to the budget that produced it.
  pacing                  JSONB,
  estimated_seconds       NUMERIC(8,2),
  prompt_tokens           INT,
  completion_tokens       INT,
  estimated_cost_usd      NUMERIC(10,6),
  -- 'ok' | 'parse_failed' | 'api_error'. A failed run is exactly the one worth keeping.
  status                  TEXT NOT NULL DEFAULT 'ok',
  error_message           TEXT,
  duration_ms             INT,
  requested_by            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_generation_runs_project ON video_generation_runs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generation_runs_storyboard ON video_generation_runs (storyboard_id);

-- ---------------------------------------------------------------------------
-- Resumable editor drafts
-- ---------------------------------------------------------------------------

-- Edits currently live only in browser state, so a refresh or a crashed tab loses them.
-- Autosave lands here — deliberately NOT in video_storyboards, because an autosave every few
-- seconds would leave forty numbered versions behind after one editing session. "Save as new
-- version" stays the explicit act that produces something renderable.
CREATE TABLE IF NOT EXISTS video_storyboard_drafts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storyboard_id  UUID NOT NULL REFERENCES video_storyboards(id) ON DELETE CASCADE,
  -- One draft per editor, so two admins on the same script do not overwrite each other silently.
  editor_email   TEXT NOT NULL,
  doc            JSONB NOT NULL,
  -- Lets the UI warn "this script has a newer version since you started editing".
  base_version   INT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storyboard_id, editor_email)
);

CREATE INDEX IF NOT EXISTS idx_video_storyboard_drafts_updated ON video_storyboard_drafts (updated_at DESC);

-- ---------------------------------------------------------------------------
-- State-transition snapshots
-- ---------------------------------------------------------------------------

-- The document as it stood at each transition, so any point is recoverable.
-- Deduplicated by checksum: a transition that does not change the doc (approve, queue, render)
-- reuses the previous snapshot instead of storing a fifth identical copy of a 200KB storyboard.
CREATE TABLE IF NOT EXISTS video_storyboard_snapshots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storyboard_id  UUID NOT NULL REFERENCES video_storyboards(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES video_projects(id) ON DELETE CASCADE,
  from_state     TEXT,
  to_state       TEXT NOT NULL,
  doc_checksum   TEXT NOT NULL,
  -- NULL when an identical checksum was already stored; reuse the earlier row's doc.
  doc            JSONB,
  actor          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_snapshots_storyboard ON video_storyboard_snapshots (storyboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_snapshots_checksum ON video_storyboard_snapshots (storyboard_id, doc_checksum);

-- ---------------------------------------------------------------------------
-- Render artifact manifest
-- ---------------------------------------------------------------------------

-- Which audio clips and captures actually went into a finished MP4. Lets a published video be
-- traced back to its exact inputs — and makes "this word is mispronounced in the video" a
-- solvable problem rather than a re-render-and-hope.
CREATE TABLE IF NOT EXISTS video_render_artifacts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  render_id      UUID REFERENCES video_renders(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES video_render_jobs(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('tts', 'broll', 'bgm', 'poster', 'captions', 'video')),
  scene_id       TEXT,
  segment_id     TEXT,
  asset_id       UUID,
  url            TEXT,
  duration_seconds NUMERIC(8,3),
  bytes          BIGINT,
  -- true when this came from cache rather than being generated for this render.
  from_cache     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_render_artifacts_render ON video_render_artifacts (render_id);
CREATE INDEX IF NOT EXISTS idx_video_render_artifacts_job ON video_render_artifacts (job_id);
