-- Opt-in for public scoreboard (Phase 9)
SET search_path TO public;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_on_scoreboard BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN profiles.show_on_scoreboard IS 'If true, user appears on public scoreboard (streaks/points)';
