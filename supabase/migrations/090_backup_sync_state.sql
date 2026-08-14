-- Tracks the full-database backup sync (Neon -> Supabase / Turso / R2), driven by
-- batched, resumable calls from /api/admin/backup/sync and /api/cron/backup-sync.
-- A single row (id=1) holds the current/most-recent run's cursor and status; batched
-- calls advance next_table_offset until all tables are processed, then reset for the
-- next run.
CREATE TABLE IF NOT EXISTS backup_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error')),
  run_started_at TIMESTAMPTZ,
  run_completed_at TIMESTAMPTZ,
  total_tables INTEGER DEFAULT 0,
  next_table_offset INTEGER DEFAULT 0,
  tables_synced_ok INTEGER DEFAULT 0,
  tables_synced_failed INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT backup_sync_state_singleton CHECK (id = 1)
);

INSERT INTO backup_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Per-table-per-run log, for the admin page's history view.
CREATE TABLE IF NOT EXISTS backup_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_started_at TIMESTAMPTZ NOT NULL,
  table_name TEXT NOT NULL,
  row_count INTEGER,
  supabase_ok BOOLEAN,
  turso_ok BOOLEAN,
  r2_ok BOOLEAN,
  error TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_sync_log_run ON backup_sync_log(run_started_at DESC);
