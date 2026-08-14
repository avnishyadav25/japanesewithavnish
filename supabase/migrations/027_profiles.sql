-- User profiles for Nihongo Navi (level from placement, display name, notification prefs)
-- Compatible with Neon Postgres

SET search_path TO public;

CREATE TABLE IF NOT EXISTS profiles (
  email TEXT PRIMARY KEY,
  recommended_level TEXT,
  display_name TEXT,
  streak_reminder_email_opt_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_recommended_level ON profiles(recommended_level);

COMMENT ON TABLE profiles IS 'User profiles: placement level, display name, and preferences for Nihongo Navi';
