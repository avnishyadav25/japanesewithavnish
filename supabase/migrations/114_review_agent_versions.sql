-- Gap-fix phase 18: review_agent_versions. Every time an agent's model_name/temperature/
-- scope (via Agent Configuration) or its prompt text (via /admin/prompts) changes, a full
-- snapshot of that agent's resulting configuration is recorded here — so a run's results can
-- always be traced back to exactly what configuration produced them, and admins can see what
-- changed and when.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS review_agent_versions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_key              TEXT NOT NULL REFERENCES content_review_agents(agent_key),
  model_name             TEXT NOT NULL,
  temperature            DOUBLE PRECISION NOT NULL,
  scope                  TEXT[] NOT NULL,
  is_enabled             BOOLEAN NOT NULL,
  prompt_content         TEXT,
  changed_by             TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_agent_versions_agent ON review_agent_versions(agent_key, created_at DESC);
