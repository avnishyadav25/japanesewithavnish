-- Generalize the replication cursor so it works for ANY single-column primary key,
-- not just a uuid column literally named "id".
--
-- Why this matters: TIGHT_REPLICATION_TABLES listed "users" (0 rows in both providers)
-- while profiles (PK: email) and user_auth (PK: email) -- the tables that actually hold
-- user identity -- could never qualify, because planForTable() required a column named
-- "id" and the cursor predicate hard-cast to ::uuid. They silently fell back to the
-- hourly PK-less snapshot path, which stopped running on 2026-07-15, and had already
-- diverged (profiles 20 vs 15, user_auth 14 vs 11) by 2026-08-14.
--
-- last_row_id was UUID, so it physically could not store an email. Widening it to TEXT
-- is what lets those tables be replicated at all. Renamed to last_pk_value because
-- "row_id" implied a uuid id column -- the whole assumption being removed here.

ALTER TABLE replication_poll_state
  ALTER COLUMN last_row_id TYPE TEXT USING last_row_id::text;

ALTER TABLE replication_poll_state
  RENAME COLUMN last_row_id TO last_pk_value;
