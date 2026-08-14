SET search_path TO public;

-- Curriculum V2: real policy-driven lesson access, replacing the purely-cosmetic
-- access_type (free/premium) column that the actual gating logic (src/lib/auth/access.ts)
-- has never read. access_type is left in place unchanged (still drives the marketing
-- "Free" badge on logged-out browsing).
--
-- Backfill note: ALL existing lessons get 'daily_free_eligible' regardless of their current
-- access_type, because that reflects how gating has always actually worked (today's sequential
-- 2-per-day mechanism applies to every lesson in a level, not just ones tagged 'free' — the
-- 'free'/'premium' tag has never been read by the paywall). This keeps behavior for all 152
-- existing lessons byte-for-byte identical after this migration; the new policy values only
-- take effect for lessons an admin deliberately reclassifies going forward.
ALTER TABLE curriculum_lessons
  ADD COLUMN IF NOT EXISTS access_policy TEXT
    CHECK (access_policy IN ('always_free','daily_free_eligible','premium_only','trial_only','admin_granted')),
  ADD COLUMN IF NOT EXISTS daily_sequence_position INTEGER,
  ADD COLUMN IF NOT EXISTS premium_bypass BOOLEAN NOT NULL DEFAULT false;

UPDATE curriculum_lessons SET access_policy = 'daily_free_eligible' WHERE access_policy IS NULL;

ALTER TABLE curriculum_lessons ALTER COLUMN access_policy SET NOT NULL;
ALTER TABLE curriculum_lessons ALTER COLUMN access_policy SET DEFAULT 'daily_free_eligible';

-- Prerequisites: purely additive, not yet enforced by canAccessLesson.
CREATE TABLE IF NOT EXISTS curriculum_lesson_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  prerequisite_lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, prerequisite_lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_prerequisites_lesson ON curriculum_lesson_prerequisites(lesson_id);
