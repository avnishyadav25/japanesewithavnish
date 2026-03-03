#!/usr/bin/env bash
set -euo pipefail

# Simple data-only migration from Supabase Postgres -> Neon Postgres.
# This does NOT touch schemas; run your Neon schema migrations first.
#
# Required env (from .env or export):
#   SUPABASE_DB_URL  - Postgres connection string for your Supabase project
#   DATABASE_URL     - Neon Postgres connection string (pooled is fine)
#
# Optional: TRUNCATE_NEON=1  - truncate Neon public tables before import (avoids duplicate key; use for re-runs)
#
# If you get "server version mismatch" (Supabase is Postgres 17), set PG_DUMP to pg_dump 17.
# Or run the API-based migrator: npx tsx scripts/migrate-supabase-to-neon-data.ts

PG_DUMP="${PG_DUMP:-pg_dump}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

TMP_SQL="${TMPDIR:-/tmp}/supabase_data_$(date +%s).sql"

echo "Exporting data from Supabase (using $PG_DUMP, INSERT format to avoid COPY/backslash issues)..."
"$PG_DUMP" --data-only --inserts --schema=public "$SUPABASE_DB_URL" > "$TMP_SQL"

if [[ -n "${TRUNCATE_NEON:-}" ]]; then
  echo "Truncating Neon public tables (TRUNCATE_NEON=1)..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET search_path TO public;" -c "
    TRUNCATE post_comments, learning_content, site_settings, download_logs, entitlements,
              payments, order_items, orders, product_assets, subscribers, quiz_attempts,
              quiz_thresholds, quiz_questions, media, pages, posts, coupons, products, users
    CASCADE;
  "
fi

echo "Importing data into Neon..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET search_path TO public;" -f "$TMP_SQL"

echo "Done. You can now verify row counts in Neon."

