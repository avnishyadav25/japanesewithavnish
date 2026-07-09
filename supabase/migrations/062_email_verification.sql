-- Soft email verification for student email/password accounts.
SET search_path TO public;

ALTER TABLE user_auth
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

UPDATE user_auth
SET email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE email_verified_at IS NULL;

COMMENT ON COLUMN user_auth.email_verified_at IS 'When the student verified their email address. Existing accounts were backfilled as verified.';
COMMENT ON COLUMN user_auth.verification_sent_at IS 'When the most recent email verification link was sent.';
