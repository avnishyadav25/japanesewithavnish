#!/usr/bin/env bash
# Full Neon migration: schema (001_neon + 002–015) then data from Supabase.
# Loads .env from repo root. Requires: DATABASE_URL, and SUPABASE_DB_URL for data step.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
cd "$REPO_ROOT"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set (add to .env or export)" >&2
  exit 1
fi

# Schema: Neon-specific 001, then 002–015 in order (set search_path for Neon)
apply_schema() {
  local psql_cmd=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET search_path TO public;")
  echo "Applying Neon schema (001_initial_schema_neon.sql)..."
  "${psql_cmd[@]}" -f "$MIGRATIONS_DIR/001_initial_schema_neon.sql"
  for f in 002_add_preview_url 003_add_product_image_url 004_site_settings 005_learning_content \
           006_social_facebook_threads_pinterest 007_posts_image_prompt 008_post_comments \
           009_homepage_settings 010_start_here_settings 011_jlpt_pinned_posts 012_blog_featured_posts \
           013_learn_recommended 014_product_gallery 015_product_flags_and_download_types 016_add_posts_topic; do
    local path="$MIGRATIONS_DIR/${f}.sql"
    if [[ -f "$path" ]]; then
      echo "Applying $f..."
      "${psql_cmd[@]}" -f "$path"
    fi
  done
  echo "Schema applied."
}

# Data: pg_dump from Supabase → import into Neon (or use API-based migrator if pg_dump version fails)
run_data_migration() {
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "SUPABASE_DB_URL not set; skipping pg_dump data migration."
    echo "  To migrate data with Supabase URL + service key only, run: npm run migrate:data"
    return 0
  fi
  export TRUNCATE_NEON="${TRUNCATE_NEON:-1}"
  if ! bash "$SCRIPT_DIR/migrate-supabase-to-neon.sh"; then
    echo "  If that failed due to pg_dump version mismatch, run: npm run migrate:data"
    return 1
  fi
  return 0
}

apply_schema
run_data_migration
echo "Full Neon migration finished."
