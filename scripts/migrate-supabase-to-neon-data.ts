/**
 * Data-only migration: Supabase (REST API) → Neon.
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (no SUPABASE_DB_URL or pg_dump).
 * Run after Neon schema is applied. Loads .env from repo root.
 *
 *   npx tsx scripts/migrate-supabase-to-neon-data.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(repoRoot: string): void {
  const p = resolve(repoRoot, ".env");
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const REPO_ROOT = resolve(__dirname, "..");
loadEnv(REPO_ROOT);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("Need DATABASE_URL in .env");
  process.exit(1);
}
// Narrowed for type-checker (validated above)
const _url = SUPABASE_URL as string;
const _key = SUPABASE_SERVICE_KEY as string;
const _db = DATABASE_URL as string;

// FK-safe order: parents before children
const TABLES = [
  "users",
  "products",
  "coupons",
  "posts",
  "pages",
  "media",
  "quiz_questions",
  "quiz_thresholds",
  "subscribers",
  "product_assets",
  "orders",
  "order_items",
  "payments",
  "entitlements",
  "download_logs",
  "site_settings",
  "learning_content",
  "post_comments",
];

const PAGE_SIZE = 500;

async function fetchAll(supabase: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.warn(`  ${table}: Supabase error ${error.code} - ${error.message}`);
      return out;
    }
    if (!data?.length) break;
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

function quoteId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Normalize value for Postgres; ensure JSONB columns get valid JSON. */
function normVal(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return null; // invalid JSON string → null so insert doesn't fail
    }
  }
  if (typeof v === "object" && !(v instanceof Date)) return v;
  return v;
}

async function main() {
  const supabase = createClient(_url, _key, { auth: { persistSession: false } });
  const pg = new Client({ connectionString: _db });
  await pg.connect();

  for (const table of TABLES) {
    const rows = await fetchAll(supabase, table);
    if (rows.length === 0) {
      console.log(`${table}: 0 rows (skip)`);
      continue;
    }
    const columns = Object.keys(rows[0]!).filter((c) => rows[0]![c] !== undefined);
    const colsSql = columns.map(quoteId).join(", ");
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const insertSql = `INSERT INTO ${quoteId(table)} (${colsSql}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((c) => normVal(row[c]));
      const res = await pg.query(insertSql, values);
      if (res.rowCount && res.rowCount > 0) inserted++;
    }
    console.log(`${table}: ${rows.length} rows, ${inserted} inserted (conflicts skipped)`);
  }

  await pg.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
