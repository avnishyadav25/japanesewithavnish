#!/usr/bin/env bash
# Weekly proof that the backups actually restore.
#
# An untested backup is not a backup, it is a hope. Everything up to this point verifies that
# a *file was written* -- this is the only thing that verifies the file can be turned back
# into a working database. It is deliberately the last line of defence and deliberately
# automated, because the failure mode it guards against (dumps that have silently been
# unusable for weeks) is only ever discovered during an incident otherwise.
#
# Restores the newest daily dump into a throwaway database, asserts row counts on the tables
# that would actually hurt to lose, then drops it.
#
# Install:
#   cp restore-test.sh /opt/jwa/ && chmod +x /opt/jwa/restore-test.sh
#   crontab -e
#   0 4 * * 1 /opt/jwa/restore-test.sh >> /var/log/jwa-restore-test.log 2>&1

set -euo pipefail

cd "$(dirname "$0")"
# shellcheck disable=SC1091
source .env

: "${PGUSER:?}" ; : "${PGPASSWORD:?}"

DAILY=/opt/jwa/backups/daily
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SCRATCH="restore_test_$(date -u +%Y%m%d)"

LATEST=$(ls -1t "$DAILY"/*.dump 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "[$STAMP] FAILED: no dump found in $DAILY" >&2
  exit 1
fi

AGE_HOURS=$(( ( $(date +%s) - $(stat -c %Y "$LATEST") ) / 3600 ))
echo "[$STAMP] restore test using $(basename "$LATEST") (${AGE_HOURS}h old, $(du -h "$LATEST" | cut -f1))"

# A backup that stopped being produced is as dangerous as one that cannot restore, and looks
# identical until you check the date.
if [ "$AGE_HOURS" -gt 48 ]; then
  echo "[$STAMP] FAILED: newest dump is ${AGE_HOURS}h old — the nightly backup is not running" >&2
  exit 1
fi

psql_scratch() { docker exec -e PGPASSWORD="$PGPASSWORD" jwa-postgres psql -U "$PGUSER" -d "$SCRATCH" -tAc "$1"; }
cleanup() {
  docker exec -e PGPASSWORD="$PGPASSWORD" jwa-postgres \
    psql -U "$PGUSER" -d postgres -tAc "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker exec -e PGPASSWORD="$PGPASSWORD" jwa-postgres createdb -U "$PGUSER" "$SCRATCH"
docker exec -e PGPASSWORD="$PGPASSWORD" jwa-postgres \
  psql -U "$PGUSER" -d "$SCRATCH" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' >/dev/null

docker exec -i -e PGPASSWORD="$PGPASSWORD" jwa-postgres \
  pg_restore -U "$PGUSER" -d "$SCRATCH" --no-owner --no-privileges /dev/stdin < "$LATEST" \
  > /tmp/jwa-restore-test.log 2>&1 || true

TABLES=$(psql_scratch "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
echo "[$STAMP] restored tables=$TABLES"

FAIL=0
# Only the tables whose loss would be unrecoverable. Content can be regenerated; a paying
# customer's entitlement cannot.
for CHECK in "profiles:1" "user_auth:1" "orders:1" "payments:1" "entitlements:1" "user_subscriptions:1"; do
  T=${CHECK%%:*}; MIN=${CHECK##*:}
  N=$(psql_scratch "select count(*) from \"$T\"" 2>/dev/null || echo "ERR")
  if [ "$N" = "ERR" ] || [ "${N:-0}" -lt "$MIN" ]; then
    echo "[$STAMP]   FAIL $T = $N (expected >= $MIN)" >&2; FAIL=1
  else
    echo "[$STAMP]   ok   $T = $N"
  fi
done

if [ "${TABLES:-0}" -lt 140 ]; then
  echo "[$STAMP] FAIL: only $TABLES tables restored, expected >= 140" >&2; FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "[$STAMP] RESTORE TEST FAILED — the backups are not usable. pg_restore log:" >&2
  tail -20 /tmp/jwa-restore-test.log >&2
  exit 1
fi

echo "[$STAMP] restore test PASSED — $(basename "$LATEST") restores to a working database"
