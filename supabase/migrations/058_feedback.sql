CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  email      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
