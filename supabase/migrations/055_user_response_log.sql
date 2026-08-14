-- Response-level data for analytics (accuracy, latency by module/submodule).

SET search_path TO public;

CREATE TABLE IF NOT EXISTS user_response_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  module_id UUID REFERENCES curriculum_modules(id) ON DELETE SET NULL,
  submodule_id UUID REFERENCES curriculum_submodules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_response_log_email ON user_response_log(user_email);
CREATE INDEX IF NOT EXISTS idx_user_response_log_created ON user_response_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_response_log_module ON user_response_log(module_id);

COMMENT ON TABLE user_response_log IS 'Per-item correct/incorrect and latency for analytics and weak-spot detection';
