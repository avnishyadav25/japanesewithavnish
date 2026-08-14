-- Records each month's top-3 XP leaderboard winners and prevents double-granting rewards.
CREATE TABLE IF NOT EXISTS leaderboard_reward_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rank INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
  user_email TEXT NOT NULL,
  xp_total INTEGER NOT NULL DEFAULT 0,
  reward_mode TEXT NOT NULL,
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending', 'granted', 'manual_review')),
  granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (period_start, rank)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_reward_cycles_period ON leaderboard_reward_cycles(period_start);
