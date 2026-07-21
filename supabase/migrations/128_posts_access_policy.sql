-- Post-level gating foundation (spec §14/Phase 12) — reuses the exact enum already proven on
-- curriculum_lessons (migration 076), not a new gating vocabulary. Unlike curriculum_lessons
-- (default 'daily_free_eligible', reflecting how its sequential unlock already worked before
-- that migration), every posts-backed content type is 100% public today with zero gating
-- mechanism anywhere — so the default here is 'always_free', making this migration a pure
-- no-op for every existing and future post until an admin deliberately reclassifies one.
-- Schema only: no enforcement wired up yet (mirrors block_access's Phase 2 -> Phase 3/4
-- sequencing) — activating real checks against these columns is Decision A, still deferred to
-- the founder (see plan: "which content types get real gating, and when").
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS access_policy TEXT NOT NULL DEFAULT 'always_free'
    CHECK (access_policy IN ('always_free','daily_free_eligible','premium_only','trial_only','admin_granted')),
  ADD COLUMN IF NOT EXISTS premium_bypass BOOLEAN NOT NULL DEFAULT false;
