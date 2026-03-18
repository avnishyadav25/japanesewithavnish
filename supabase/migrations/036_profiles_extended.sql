-- Extended profiles: first/last name, is_active, last_login, avatar, address, phone, social, website
SET search_path TO public;

-- Profiles: keep display_name for backward compat; add first_name, last_name (display_name can be computed)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.is_active IS 'If false, user is deactivated by admin';
COMMENT ON COLUMN profiles.last_login_at IS 'Last successful login timestamp';
COMMENT ON COLUMN profiles.avatar_url IS 'Profile picture URL (e.g. R2)';
COMMENT ON COLUMN profiles.website IS 'Personal website URL';
