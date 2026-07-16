-- Gap-fix phase 23 (part 1 of 3: job cancellation). Adds 'cancelled' as a real job status so
-- an admin can cancel a queued job (e.g. a mis-click, or a job made redundant by a newer one)
-- without it sitting there until the cron eventually claims and runs it.
SET search_path TO public;

ALTER TABLE content_review_jobs DROP CONSTRAINT content_review_jobs_status_check;
ALTER TABLE content_review_jobs ADD CONSTRAINT content_review_jobs_status_check
  CHECK (status IN ('queued', 'claimed', 'running', 'completed', 'failed', 'cancelled'));
