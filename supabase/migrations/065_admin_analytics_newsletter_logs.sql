SET search_path TO public;

ALTER TABLE content_events
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_content_events_path ON content_events(path);
CREATE INDEX IF NOT EXISTS idx_content_events_country ON content_events(country);
CREATE INDEX IF NOT EXISTS idx_content_events_session ON content_events(session_id);
CREATE INDEX IF NOT EXISTS idx_content_events_created_path ON content_events(created_at DESC, path);
CREATE INDEX IF NOT EXISTS idx_content_events_type_created ON content_events(content_type, content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_send_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_logs_newsletter ON newsletter_send_logs(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_logs_email ON newsletter_send_logs(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_logs_sent_at ON newsletter_send_logs(sent_at DESC);
