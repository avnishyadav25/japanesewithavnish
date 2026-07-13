-- Rate-limiting for AI-personalized re-engagement nudges, mirroring last_streak_reminder_sent_at.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_nudge_sent_at DATE;
