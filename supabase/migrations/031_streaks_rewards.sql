-- Streaks, rewards, and streak-reminder tracking for Nihongo Navi
SET search_path TO public;

-- Extend profiles with activity and reminder tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_activity_date DATE,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_reminder_sent_at DATE;

-- Reward events (daily login, exercise complete, streak milestones)
CREATE TABLE IF NOT EXISTS reward_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_events_email ON reward_events(user_email);
CREATE INDEX IF NOT EXISTS idx_reward_events_created ON reward_events(created_at DESC);
