-- AI generation log: prompt sent and result preview for auditing
CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  log_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  model_used TEXT NOT NULL,
  prompt_sent TEXT,
  result_preview TEXT,
  result_metadata JSONB,
  admin_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_entity ON ai_generation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON ai_generation_logs(created_at DESC);
