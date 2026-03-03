-- Content analytics: views and duration per content
CREATE TABLE IF NOT EXISTS content_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  duration_seconds INTEGER,
  session_id TEXT,
  path TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_events_content ON content_events(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_events_created_at ON content_events(created_at DESC);
