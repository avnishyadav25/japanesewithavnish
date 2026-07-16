-- Gap-fix phase 8: event-driven re-review. Content edits made through the normal admin
-- editors (posts route, learning-content route, bulk route) now queue a re-review
-- automatically when the post already has a completed review and its content actually
-- changed (checksum-compared, same signal scheduledReReview.ts uses) — instead of only
-- being caught by that up-to-90-day sweep or a human remembering to click "Run Review".
-- 'content_edit' is a new trigger_type distinct from 'manual_single' (an admin explicitly
-- clicked Run Review) and 'bulk_sweep' (the cron-driven staleness sweep), so the Jobs list
-- can show why a job exists.
SET search_path TO public;

ALTER TABLE content_review_jobs DROP CONSTRAINT content_review_jobs_trigger_type_check;
ALTER TABLE content_review_jobs ADD CONSTRAINT content_review_jobs_trigger_type_check
  CHECK (trigger_type IN ('manual_single', 'bulk_sweep', 'content_edit'));
