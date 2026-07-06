-- Add streak freezes count column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_freezes INT NOT NULL DEFAULT 0;
