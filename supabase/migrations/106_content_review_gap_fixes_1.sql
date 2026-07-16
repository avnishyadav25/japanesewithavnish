-- Gap-analysis fixes, batch 1: stricter publish gate needs to know which required agents
-- failed to run (jobRunner.ts currently only console.errors an agent failure, nothing
-- queryable records it).
SET search_path TO public;

ALTER TABLE content_review_runs ADD COLUMN IF NOT EXISTS failed_agent_keys TEXT[];
