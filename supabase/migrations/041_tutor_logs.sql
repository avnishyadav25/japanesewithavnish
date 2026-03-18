SET search_path TO public;

CREATE TABLE IF NOT EXISTS tutor_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  question TEXT NOT NULL,
  normalized_question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ask_count INTEGER NOT NULL DEFAULT 1,
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_logs_normalized_question
  ON tutor_logs (normalized_question);

CREATE INDEX IF NOT EXISTS idx_tutor_logs_last_asked
  ON tutor_logs (last_asked_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_logs_user_email
  ON tutor_logs (user_email);

