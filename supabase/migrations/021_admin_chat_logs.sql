-- Admin test chatbot: log each message per session for review
CREATE TABLE IF NOT EXISTS admin_chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_logs_session ON admin_chat_logs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_chat_logs_created_at ON admin_chat_logs(created_at DESC);
