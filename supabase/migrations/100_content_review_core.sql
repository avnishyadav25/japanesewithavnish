-- Content Review Center (Phase 1): AI review agents produce structured findings against
-- posts-backed content (grammar/vocabulary/kanji/reading/listening/writing/sounds); a human
-- decides on each finding; only content clear of open critical findings can (re-)publish.
--
-- Scope note: this is deliberately separate from lesson_blocks.review_status/reviewed_by/
-- reviewed_at (migration 073), which is a narrower, already-working gate for curriculum
-- lesson body blocks only. Do not touch lesson_blocks here.
--
-- Naming note: review_schedule already exists (migrations 029/097) as an unrelated
-- per-learner SM-2 spaced-repetition queue. Every table below is prefixed content_review_
-- to avoid any confusion with it.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS content_review_agents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_key         TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  scope             TEXT[] NOT NULL DEFAULT '{}',
  prompt_key        TEXT NOT NULL,
  prompt_version    INT NOT NULL DEFAULT 1,
  model_name        TEXT NOT NULL DEFAULT 'deepseek-chat',
  is_deterministic  BOOLEAN NOT NULL DEFAULT false,
  is_enabled        BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_review_jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  trigger_type          TEXT NOT NULL DEFAULT 'manual_single'
                          CHECK (trigger_type IN ('manual_single', 'bulk_sweep')),
  status                TEXT NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'claimed', 'running', 'completed', 'failed')),
  requested_agent_keys  TEXT[],
  attempt_count         INT NOT NULL DEFAULT 0,
  max_attempts          INT NOT NULL DEFAULT 3,
  error_message         TEXT,
  requested_by          TEXT,
  claimed_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_review_jobs_queued
  ON content_review_jobs(created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_content_review_jobs_entity
  ON content_review_jobs(entity_type, entity_id);
-- At most one in-flight job per entity: guards a double-click and an overlapping bulk sweep
-- from both queuing work for the same post.
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_review_jobs_one_active_per_entity
  ON content_review_jobs(entity_type, entity_id) WHERE status IN ('queued', 'claimed', 'running');

CREATE TABLE IF NOT EXISTS content_review_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID REFERENCES content_review_jobs(id) ON DELETE SET NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_snapshot  JSONB NOT NULL,
  content_checksum  TEXT NOT NULL,
  overall_status    TEXT NOT NULL DEFAULT 'pending'
                      CHECK (overall_status IN ('pending', 'validation_failed', 'completed', 'error')),
  publish_ready     BOOLEAN NOT NULL DEFAULT false,
  overall_score     INT,
  category_scores   JSONB,
  summary           TEXT,
  agent_keys_run    TEXT[],
  model_versions    JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_review_runs_entity
  ON content_review_runs(entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_review_findings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_run_id    UUID NOT NULL REFERENCES content_review_runs(id) ON DELETE CASCADE,
  agent_key        TEXT NOT NULL REFERENCES content_review_agents(agent_key),
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'suggestion', 'info')),
  category         TEXT NOT NULL,
  field_name       TEXT,
  original_value   JSONB,
  suggested_value  JSONB,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'accepted', 'rejected', 'fixed', 'false_positive')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_review_findings_run ON content_review_findings(review_run_id);
CREATE INDEX IF NOT EXISTS idx_content_review_findings_open
  ON content_review_findings(review_run_id, severity) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS content_review_decisions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id     UUID NOT NULL REFERENCES content_review_findings(id) ON DELETE CASCADE,
  decision       TEXT NOT NULL CHECK (decision IN ('accept', 'reject', 'mark_fixed', 'false_positive')),
  decision_note  TEXT,
  decided_by     TEXT NOT NULL,
  decided_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_review_decisions_finding ON content_review_decisions(finding_id);

-- Additive only. Does NOT touch lesson_blocks.review_status/reviewed_by/reviewed_at (migration 073).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'not_reviewed'
  CHECK (review_state IN (
    'not_reviewed', 'queued', 'validating', 'validation_failed', 'ai_reviewing',
    'needs_human_review', 'changes_requested', 'approved', 'publish_ready',
    'published', 'rejected', 'archived'
  ));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_review_run_id UUID REFERENCES content_review_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_review_state ON posts(review_state) WHERE review_state <> 'not_reviewed';
