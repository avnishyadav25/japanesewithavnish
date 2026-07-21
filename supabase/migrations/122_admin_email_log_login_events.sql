-- Phase 8 of the admin panel overhaul: per-user admin-sent email log and login history.
-- XP/points change history already exists (reward_events, migration 031) — reused as-is
-- for the activity trace rather than building a duplicate ledger table.

SET search_path TO public;

-- One row per admin-initiated email to a specific user (manual or template-based),
-- modeled on newsletter_send_logs (migration 065).
CREATE TABLE IF NOT EXISTS admin_email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  sent_by_admin_email TEXT NOT NULL,
  template_key TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_email_log_user ON admin_email_log(user_email);
CREATE INDEX IF NOT EXISTS idx_admin_email_log_sent_at ON admin_email_log(sent_at DESC);

-- Login history — profiles.last_login_at only ever held the most recent login with no
-- history. Populated going forward only from the point this ships (no historical backfill
-- is possible since prior logins were never recorded anywhere).
CREATE TABLE IF NOT EXISTS user_login_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  logged_in_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user ON user_login_events(user_email);
CREATE INDEX IF NOT EXISTS idx_user_login_events_logged_in_at ON user_login_events(logged_in_at DESC);

COMMENT ON TABLE admin_email_log IS 'Log of admin-sent emails (manual or template-based) to individual users, shown on the admin user detail page';
COMMENT ON TABLE user_login_events IS 'Login history per user, populated going forward only (no backfill possible)';
