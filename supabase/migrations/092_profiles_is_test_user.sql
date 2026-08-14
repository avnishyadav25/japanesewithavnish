-- Flags internal/QA accounts so they can be excluded from the public scoreboard and
-- from winning the real monthly top-3 XP leaderboard reward, while still being
-- reachable via newsletter test-sends.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT false;
