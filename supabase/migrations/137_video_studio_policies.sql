-- Video Studio: approval policy engine + audit log.
--
-- One table expresses all three approval styles that were asked for, chosen per job type
-- rather than globally:
--   auto         enqueue -> script -> render -> publish, no human in the loop (bulk shorts)
--   script_gate  a human approves the narration BEFORE any render minutes are burned
--   dual_gate    a human approves the script AND watches the finished MP4 before it goes out
--
-- Resolution is most-specific-match-wins: filter rows matching the request, score each by how
-- many of its four dimensions are not the '*' wildcard, break ties on priority. A catch-all
-- row guarantees resolution never returns nothing.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS video_policies (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label                TEXT NOT NULL,
  scope_kind           TEXT NOT NULL DEFAULT '*',
  content_type         TEXT NOT NULL DEFAULT '*',
  format               TEXT NOT NULL DEFAULT '*',
  publish_target_kind  TEXT NOT NULL DEFAULT '*',
  mode                 TEXT NOT NULL CHECK (mode IN ('auto', 'script_gate', 'dual_gate')),
  priority             INT NOT NULL DEFAULT 100,
  is_enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope_kind, content_type, format, publish_target_kind)
);

CREATE INDEX IF NOT EXISTS idx_video_policies_enabled ON video_policies (priority) WHERE is_enabled;

CREATE TABLE IF NOT EXISTS video_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID REFERENCES video_projects(id) ON DELETE CASCADE,
  storyboard_id  UUID REFERENCES video_storyboards(id) ON DELETE SET NULL,
  render_job_id  UUID REFERENCES video_render_jobs(id) ON DELETE SET NULL,
  render_id      UUID REFERENCES video_renders(id) ON DELETE SET NULL,
  -- Admin email, or a system actor like 'worker:github-actions' / 'policy-engine'.
  actor          TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_events_project ON video_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_created ON video_events (created_at DESC);

-- Seeded defaults. The catch-all is script_gate rather than auto: the safe failure mode for an
-- unrecognised combination is "a human looks at it", not "it publishes itself".
INSERT INTO video_policies (label, scope_kind, content_type, format, publish_target_kind, mode, priority)
VALUES
  ('Default — review the script', '*', '*', '*', '*', 'script_gate', 1000),
  ('Bulk vocabulary shorts to our own site', 'content_batch', 'vocabulary', '*', 'site', 'auto', 100),
  ('Bulk kanji shorts to our own site', 'content_batch', 'kanji', '*', 'site', 'auto', 100),
  ('Anything going to YouTube', '*', '*', '*', 'youtube', 'dual_gate', 50),
  ('Anything going to Instagram', '*', '*', '*', 'instagram', 'dual_gate', 50),
  ('Anything going to TikTok', '*', '*', '*', 'tiktok', 'dual_gate', 50),
  ('Full lesson walkthroughs', 'curriculum_lesson', '*', '*', '*', 'dual_gate', 60)
ON CONFLICT (scope_kind, content_type, format, publish_target_kind) DO NOTHING;
