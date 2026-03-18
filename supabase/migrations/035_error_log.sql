-- Central error log for auth, AI, signup, etc.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_source ON error_log(source);

COMMENT ON TABLE error_log IS 'Application errors for debugging (login, signup, AI, etc.)';
