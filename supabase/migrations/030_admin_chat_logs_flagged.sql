-- Add flag for AI review queue (human-in-the-loop)
SET search_path TO public;

ALTER TABLE admin_chat_logs
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating INTEGER;

CREATE INDEX IF NOT EXISTS idx_admin_chat_logs_flagged ON admin_chat_logs(flagged) WHERE flagged = TRUE;
