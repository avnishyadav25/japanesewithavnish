#!/usr/bin/env bash
# Refreshes the VPS shadow database from the current primary.
#
# During the shadow period the VPS is not in the replication topology -- the poller keeps
# Supabase in sync, not this -- so the shadow would otherwise drift further from the primary
# every day and tell us nothing useful at cutover time. A nightly full reload is the
# simplest thing that keeps it honest for a 71MB database.
#
# Install:
#   cp shadow-refresh.sh /opt/jwa/ && chmod +x /opt/jwa/shadow-refresh.sh
#   # add NEON_URL='postgresql://...' to /opt/jwa/.env  (the primary to copy FROM)
#   crontab -e
#   17 3 * * * /opt/jwa/shadow-refresh.sh >> /var/log/jwa-shadow.log 2>&1
#
# Deliberately NOT a substitute for backups. This mirrors the primary, so anything deleted
# there is deleted here on the next run. Phase 4's pg_dump retention is the actual recovery
# path.

set -euo pipefail

cd "$(dirname "$0")"
# shellcheck disable=SC1091
source .env

: "${PGUSER:?PGUSER missing from .env}"
: "${PGPASSWORD:?PGPASSWORD missing from .env}"
: "${PGDATABASE:?PGDATABASE missing from .env}"
: "${NEON_URL:?NEON_URL missing from .env — the primary connection string to copy from}"

DST="postgresql://${PGUSER}:${PGPASSWORD}@localhost:5432/${PGDATABASE}"
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "[$STAMP] shadow refresh starting"

# Streamed rather than staged through a file: no dump is left on disk holding a copy of the
# whole database, and nothing has to be cleaned up if this dies halfway.
#
# --clean --if-exists emits two harmless errors on every run: DROP SCHEMA public fails
# because the uuid-ossp extension depends on it, and CREATE SCHEMA public fails because it
# already exists. Both are expected; the tables themselves drop and recreate normally.
docker exec \
  -e SRC="$NEON_URL" \
  -e DST="$DST" \
  jwa-postgres \
  sh -c 'pg_dump -Fc --no-owner --no-privileges --schema=public "$SRC" \
         | pg_restore -d "$DST" --no-owner --no-privileges --clean --if-exists' \
  2>&1 | grep -viE 'DROP SCHEMA IF EXISTS public|schema "public" already exists|cannot drop schema public|extension uuid-ossp depends|Use DROP \.\.\. CASCADE|^$' || true

# Assert the reload actually produced a usable database. A refresh that silently restores
# nothing is worse than one that fails loudly, because the shadow would still look present.
read -r TABLES PROFILES <<<"$(docker exec -e PGPASSWORD="$PGPASSWORD" jwa-postgres \
  psql -U "$PGUSER" -d "$PGDATABASE" -tAc \
  "select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')||' '||(select count(*) from profiles)")"

echo "[$STAMP] tables=$TABLES profiles=$PROFILES"

if [ "${TABLES:-0}" -lt 140 ] || [ "${PROFILES:-0}" -lt 1 ]; then
  echo "[$STAMP] FAILED sanity check (expected >=140 tables and >=1 profile)" >&2
  exit 1
fi

echo "[$STAMP] shadow refresh ok"
