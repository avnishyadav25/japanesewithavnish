-- Resumable per-tab cursor for the Google Sheets export (src/lib/google-sheets-export.ts).
-- Sheets is a periodic, human-readable export for reporting — never a switchable
-- database backend (see docs/db-failover — Orders/Leaderboard tabs only).
CREATE TABLE IF NOT EXISTS sheets_export_state (
  tab_name TEXT PRIMARY KEY,
  last_cursor_value TIMESTAMPTZ,
  last_exported_at TIMESTAMPTZ,
  last_error TEXT,
  rows_exported_total BIGINT NOT NULL DEFAULT 0
);
