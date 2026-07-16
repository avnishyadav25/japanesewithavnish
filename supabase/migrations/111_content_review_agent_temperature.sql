-- Gap-fix phase 12 (model-tiering): the Phase 5 Agent Configuration page and its PATCH route
-- (src/app/api/admin/review/agents/[agentKey]/route.ts) have referenced a `temperature`
-- column since they were built, but no migration ever created it — every save on that page
-- (even just toggling is_enabled) has been crashing with "column does not exist". Adding it
-- now, defaulted to 0.1 to match callReviewAgent.ts's previously-hardcoded value, so existing
-- behavior doesn't change until an admin actually edits it.
SET search_path TO public;

ALTER TABLE content_review_agents ADD COLUMN IF NOT EXISTS temperature DOUBLE PRECISION NOT NULL DEFAULT 0.1;
