-- Phase 0c of the public-view overhaul: listening_questions never had an explanation
-- column, so AI-generated explanations authored via the content_blocks admin editor had
-- nowhere to sync to and were silently lost. Additive, defaults NULL — no behavior change
-- for existing rows until listeningSync.ts (updated alongside this migration) starts writing it.

SET search_path TO public;

ALTER TABLE listening_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
