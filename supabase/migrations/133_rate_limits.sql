-- Durable rate-limit counters for public forms (contact, newsletter, lead magnet,
-- blog comments, quiz submission). Replaces in-memory Map-based limiters, which reset
-- on every serverless cold start and aren't shared across concurrent Lambda instances,
-- so they weren't reliably enforcing limits in production.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
