-- Content Review Center Phase 3 + Phase 4 (per the founder's spec section 23):
-- Duplicate Detector, Auto-draft fixes, Coverage matrix, Learner reports, Agent analytics,
-- Cost analytics, Scheduled re-review (Phase 3); Adaptive remediation, Content performance
-- correlation, Reviewer calibration (Phase 4 — the 3 items not blocked by the flat-admin
-- decision). External educator review and Multi-reviewer approval remain deferred, same as
-- the reviewer-roles decision from Phase 1 (both need a second distinct reviewer identity).
SET search_path TO public;

-- Learner-facing "Report an Issue" — distinct from the generic `feedback` table (which has
-- no content reference at all): this is always tied to one specific piece of content.
CREATE TABLE IF NOT EXISTS learner_content_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN (
    'japanese_mistake', 'wrong_meaning', 'wrong_reading', 'wrong_answer',
    'audio_problem', 'broken_image', 'too_difficult', 'unclear', 'duplicate', 'other'
  )),
  message       TEXT,
  reporter_email TEXT,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'resolved', 'dismissed')),
  review_job_id UUID REFERENCES content_review_jobs(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learner_content_reports_entity ON learner_content_reports(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_learner_content_reports_status ON learner_content_reports(status) WHERE status = 'new';

-- Auto-draft fixes: tracks when a suggested_value was actually applied to live content via
-- the Apply Fix action (distinct from a finding a human marked "fixed" after editing
-- manually without using that action — this column is only set by applyFix.ts).
ALTER TABLE content_review_findings ADD COLUMN IF NOT EXISTS applied_fix_at TIMESTAMPTZ;

-- Duplicate Detector: final_aggregator's duplicate_groups output (arrays of finding ids
-- that represent the same underlying issue from different agents), captured for real now.
ALTER TABLE content_review_runs ADD COLUMN IF NOT EXISTS duplicate_groups JSONB;

-- Cost analytics: token usage accumulated across every agent call in a run.
ALTER TABLE content_review_runs ADD COLUMN IF NOT EXISTS total_prompt_tokens INT;
ALTER TABLE content_review_runs ADD COLUMN IF NOT EXISTS total_completion_tokens INT;
ALTER TABLE content_review_runs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 5);
