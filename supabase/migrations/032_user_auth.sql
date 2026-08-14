-- Email/password auth for students (sign up / sign in)
SET search_path TO public;

CREATE TABLE IF NOT EXISTS user_auth (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_auth IS 'Student email/password credentials for sign-in (hashed)';
