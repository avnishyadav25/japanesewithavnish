-- Phase 2 of the public-view overhaul: per-block access gating foundation.
-- Additive, defaults 'public' — every existing block stays fully visible until an
-- admin explicitly downgrades it (Phase 3 admin UI). No behavior change on ship day.

SET search_path TO public;

ALTER TABLE lesson_blocks
  ADD COLUMN IF NOT EXISTS block_access TEXT NOT NULL DEFAULT 'public'
    CHECK (block_access IN ('public', 'free_account', 'daily_unlocked', 'premium', 'preview'));

ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS block_access TEXT NOT NULL DEFAULT 'public'
    CHECK (block_access IN ('public', 'free_account', 'daily_unlocked', 'premium', 'preview'));

COMMENT ON COLUMN lesson_blocks.block_access IS 'Per-block access tier: public/free_account/daily_unlocked/premium/preview. daily_unlocked only has a real backing mechanism for lesson_blocks (see src/lib/auth/access.ts daily_lesson_access).';
COMMENT ON COLUMN content_blocks.block_access IS 'Per-block access tier: public/free_account/daily_unlocked/premium/preview. daily_unlocked is treated as a no-op (falls back to premium) here — no daily-post-quota system exists.';
