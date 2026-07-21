-- Backs the admin "Generate with AI" mock-test modal. Deliberately client-polling-driven, not a
-- cron-worker queue like content_review_jobs: a full mock test's ~16 LLM calls + TTS fetches
-- would exceed a serverless function's request timeout in one shot, so each poll from the admin
-- UI advances exactly one step (one LLM call) and returns progress — no background worker
-- needed, and the admin gets near-real-time feedback instead of the review-worker cron's
-- up-to-10-minute pickup latency (acceptable there since nobody is actively watching; not
-- acceptable here, where an admin is looking at an open modal).
CREATE TABLE IF NOT EXISTS practice_test_generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  level TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('full', 'mini')),
  target_post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- non-null = append to this existing post instead of creating a new one
  result_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  steps JSONB NOT NULL, -- ordered step plan, built once at creation
  step_index INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL, -- accumulated JobState (sections generated so far) between steps
  log JSONB NOT NULL DEFAULT '[]'::jsonb, -- short human-readable line per completed step, for the modal's progress list
  error_message TEXT,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_test_generation_jobs_status ON practice_test_generation_jobs(status) WHERE status = 'running';
