-- Mock-test metadata additions (JLPT mock-test system overhaul): distinguishes full vs. mini
-- mock tests and records the intended attempt policy for display. No `level` column — reuses
-- posts.jlpt_level like every other content type. No "platform-designed" flag — every row on
-- this platform is platform-designed (no licensed JLPT content exists here), so a column that
-- can never be false would be dead weight; that label is a static UI string instead.
-- attempt_policy deliberately ships without 'daily_limit' — that value needs a parameterized
-- count column to render real copy and nothing enforces it yet; add both together later
-- (mirrors how posts.access_policy shipped schema-first with enforcement deferred).
ALTER TABLE practice_tests
  ADD COLUMN IF NOT EXISTS test_variant TEXT NOT NULL DEFAULT 'full'
    CHECK (test_variant IN ('full','mini')),
  ADD COLUMN IF NOT EXISTS attempt_policy TEXT NOT NULL DEFAULT 'unlimited'
    CHECK (attempt_policy IN ('unlimited','one_time'));
