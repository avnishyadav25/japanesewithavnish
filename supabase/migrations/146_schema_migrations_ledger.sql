-- A ledger of which migrations have been applied.
--
-- Until now there was none: README told you to paste each file into a SQL editor by hand.
-- That is exactly how the Supabase standby drifted 44 tables behind the primary without
-- anyone noticing -- there was no way to ask a database what it had actually run, so the
-- only way to detect drift was to diff two live schemas and hope someone thought to look.
--
-- Every migration must now be applied through scripts/migrate.ts (npm run db:migrate),
-- which records the filename here and, by default, applies to BOTH providers so they
-- cannot diverge again.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- sha256 of the file at apply time. Lets the runner detect a migration that was edited
  -- after being applied -- a silent source of provider drift, since one side would have
  -- run the old text and the other the new.
  checksum    TEXT
);

COMMENT ON TABLE schema_migrations IS
  'Applied-migration ledger. Written by scripts/migrate.ts; never edit by hand.';
