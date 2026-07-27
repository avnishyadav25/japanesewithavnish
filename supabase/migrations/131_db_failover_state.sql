-- Control-plane state for live Neon <-> Supabase failover. This is audit/display
-- data only — the actual request-routing decision reads the flag stored in Turso
-- (src/lib/db/resolve-provider.ts), never these tables, so knowing "which DB is
-- active" doesn't require first querying the DB that might be down. Applied
-- identically to both Neon and Supabase (see scripts/check-schema-parity.ts).
CREATE TABLE IF NOT EXISTS db_failover_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  active_provider TEXT NOT NULL DEFAULT 'neon' CHECK (active_provider IN ('neon', 'supabase')),
  standby_provider TEXT CHECK (standby_provider IN ('neon', 'supabase')),
  replication_mode TEXT CHECK (replication_mode IN ('logical', 'polling')),
  last_switch_at TIMESTAMPTZ,
  last_switch_by TEXT,
  standby_lag_seconds NUMERIC,
  standby_health TEXT NOT NULL DEFAULT 'unknown' CHECK (standby_health IN ('healthy', 'degraded', 'unknown', 'orphaned')),
  schema_parity_ok BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT db_failover_state_singleton CHECK (id = 1)
);

INSERT INTO db_failover_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Append-only audit trail of switches, for the admin dashboard's history view.
CREATE TABLE IF NOT EXISTS db_failover_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_provider TEXT NOT NULL CHECK (from_provider IN ('neon', 'supabase')),
  to_provider TEXT NOT NULL CHECK (to_provider IN ('neon', 'supabase')),
  triggered_by TEXT NOT NULL,
  measured_lag_seconds NUMERIC,
  forced BOOLEAN NOT NULL DEFAULT FALSE,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_failover_log_created ON db_failover_log(created_at DESC);

-- Per-table cursor for the tight-interval polling sync (src/lib/db/replication-poll.ts).
-- Lives on whichever side is currently the *standby* (the one being written to) —
-- tracks "how far this side has ingested from the current primary." Reset when the
-- primary/standby direction flips (Phase 5 switch), since the cursor's meaning is
-- direction-relative.
CREATE TABLE IF NOT EXISTS replication_poll_state (
  table_name TEXT PRIMARY KEY,
  last_cursor_value TIMESTAMPTZ,
  last_row_id UUID,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  rows_synced_total BIGINT NOT NULL DEFAULT 0
);
