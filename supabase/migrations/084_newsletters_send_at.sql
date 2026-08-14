-- Newsletter scheduling: a draft with send_at in the past gets picked up by the
-- send-scheduled-newsletters cron route.
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS send_at TIMESTAMPTZ;
