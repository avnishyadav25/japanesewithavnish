#!/usr/bin/env bash
# Nightly backup of the PRIMARY database to VPS disk and Cloudflare R2.
#
# This is the actual recovery path, and it is not the same thing as the shadow refresh.
# shadow-refresh.sh MIRRORS the primary -- anything deleted or corrupted there is deleted or
# corrupted on the shadow the next night. If data is lost on a Tuesday, by Wednesday morning
# both databases agree on the loss. Only these dated snapshots can undo that.
#
# Retention: 7 daily, 4 weekly (Sundays), 6 monthly (1st of month). Weekly and monthly are
# hardlinks to the daily file, so a retained snapshot costs disk once regardless of how many
# tiers reference it.
#
# Install:
#   cp backup.sh /opt/jwa/ && chmod +x /opt/jwa/backup.sh
#   # /opt/jwa/.env needs, in addition to the shadow-refresh vars:
#   #   PRIMARY_URL='postgresql://...'   (defaults to NEON_URL if unset)
#   #   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
#   crontab -e
#   40 2 * * * /opt/jwa/backup.sh >> /var/log/jwa-backup.log 2>&1
#
# Runs BEFORE the 03:17 shadow refresh deliberately: back up the primary's state first, then
# mirror it. The reverse order would mean a bad night's mirror happens before the snapshot
# that could undo it.

set -euo pipefail

cd "$(dirname "$0")"
# shellcheck disable=SC1091
source .env

SRC="${PRIMARY_URL:-${NEON_URL:-}}"
: "${SRC:?PRIMARY_URL or NEON_URL must be set in .env}"
: "${R2_ENDPOINT:?}" ; : "${R2_ACCESS_KEY_ID:?}" ; : "${R2_SECRET_ACCESS_KEY:?}" ; : "${R2_BUCKET_NAME:?}"

# Paths as the HOST sees them, and as the CONTAINER sees them via the ./backups bind mount.
# Everything pg_dump/pg_restore touches uses the container path so the archive is a real
# seekable file; the host paths are only for linking, pruning and uploading.
ROOT=/opt/jwa/backups
CROOT=/backups
DAILY="$ROOT/daily"; WEEKLY="$ROOT/weekly"; MONTHLY="$ROOT/monthly"
mkdir -p "$DAILY" "$WEEKLY" "$MONTHLY"

DATE=$(date -u +%Y-%m-%d)
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FILE="jwa-${DATE}.dump"
DEST="$DAILY/$FILE"

echo "[$STAMP] backup starting -> $FILE"

# Dump to a temp name and only promote on success, so a failed or truncated run can never
# masquerade as that day's backup. Custom format (-Fc) is compressed and restores selectively.
TMP="$DAILY/.${FILE}.partial"
CTMP="$CROOT/daily/.${FILE}.partial"
docker exec -e SRC="$SRC" jwa-postgres \
  pg_dump -Fc --no-owner --no-privileges --schema=public -f "$CTMP" "$SRC"

# A dump small enough to be an error page or an empty archive is not a backup. The real one
# is ~8MB; 1MB is a generous floor that still catches catastrophic truncation.
SIZE=$(wc -c < "$TMP")
if [ "$SIZE" -lt 1000000 ]; then
  echo "[$STAMP] FAILED: dump is only ${SIZE} bytes, refusing to keep it" >&2
  rm -f "$TMP"; exit 1
fi

# Verify the archive is readable before trusting it. pg_restore --list parses the table of
# contents without touching a database, so this is cheap and catches corruption at write time
# rather than during an incident.
if ! VERIFY=$(docker exec jwa-postgres pg_restore --list "$CTMP" 2>&1); then
  echo "[$STAMP] FAILED: archive is not readable by pg_restore" >&2
  echo "$VERIFY" | head -5 >&2
  rm -f "$TMP"; exit 1
fi
echo "[$STAMP] archive verified: $(echo "$VERIFY" | grep -c 'TABLE DATA') tables of data"

mv "$TMP" "$DEST"
echo "[$STAMP] dump ok: $(du -h "$DEST" | cut -f1)"

# Promote into the weekly/monthly tiers by hardlink -- same inode, so retaining a snapshot in
# three tiers costs the bytes once.
[ "$(date -u +%u)" = "7" ] && ln -f "$DEST" "$WEEKLY/$FILE"  && echo "[$STAMP] linked into weekly"
[ "$(date -u +%d)" = "01" ] && ln -f "$DEST" "$MONTHLY/$FILE" && echo "[$STAMP] linked into monthly"

# Offsite. Uses the aws-cli container rather than installing anything on the host; R2 speaks
# S3 with an explicit endpoint.
docker run --rm \
  -v "$DAILY:/backups:ro" \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli s3 cp "/backups/$FILE" "s3://$R2_BUCKET_NAME/db-backups/$FILE" \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors
echo "[$STAMP] uploaded to R2: db-backups/$FILE"

# Prune by count, newest first. Done after the upload so a pruning bug cannot destroy the
# snapshot this run just produced.
prune() {
  local dir="$1" keep="$2"
  local n=0
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.dump 2>/dev/null | while read -r f; do
    n=$((n + 1))
    [ "$n" -gt "$keep" ] && { rm -f "$f"; echo "[$STAMP] pruned $(basename "$f") from $(basename "$dir")"; }
  done
  true
}
prune "$DAILY" 7
prune "$WEEKLY" 4
prune "$MONTHLY" 6

echo "[$STAMP] retained: daily=$(ls -1 "$DAILY"/*.dump 2>/dev/null | wc -l) weekly=$(ls -1 "$WEEKLY"/*.dump 2>/dev/null | wc -l) monthly=$(ls -1 "$MONTHLY"/*.dump 2>/dev/null | wc -l)"
echo "[$STAMP] backup ok"
