import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
};

/** Maps a Postgres data type to a SQLite storage class for Turso. SQLite has dynamic
 * typing / type affinity, so this only needs to pick a reasonable affinity — it doesn't
 * need to be exact, unlike the Postgres-to-Postgres mapping for Supabase. */
function pgTypeToSqlite(dataType: string, udtName: string): string {
  if (dataType === "ARRAY" || udtName.startsWith("_")) return "TEXT"; // JSON-encoded
  switch (dataType) {
    case "integer":
    case "smallint":
    case "bigint":
      return "INTEGER";
    case "boolean":
      return "INTEGER";
    case "numeric":
    case "real":
    case "double precision":
      return "REAL";
    case "jsonb":
    case "json":
      return "TEXT";
    case "uuid":
    case "text":
    case "character varying":
    case "date":
    case "timestamp without time zone":
    case "timestamp with time zone":
      return "TEXT";
    default:
      return "TEXT";
  }
}

// Supabase DDL generation was removed on 2026-08-14. Supabase is no longer an archival
// backup target -- it is a live hot standby, schema-identical to the primary and kept
// current by the PK-matched upsert path in src/lib/db/replication-poll.ts.
//
// The generated file was actively dangerous once that changed: it emitted
// "DROP TABLE IF EXISTS" followed by a CREATE with no primary keys, so running it against
// today's Supabase would destroy the standby and recreate it in the exact PK-less shape
// that made failover impossible in the first place. Rebuild the standby from a primary
// pg_dump instead. Turso stays PK-less by design -- correct for an archive.

async function main() {
  const tableRows = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN (
        'backup_sync_state', 'backup_sync_log',
        'db_failover_state', 'db_failover_log', 'replication_poll_state',
        'sheets_export_state'
      )
    ORDER BY table_name
  `) as { table_name: string }[];
  const tableNames = tableRows.map((r) => r.table_name);

  const columnRows = (await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${tableNames})
    ORDER BY table_name, ordinal_position
  `) as ColumnInfo[];

  const columnsByTable = new Map<string, ColumnInfo[]>();
  for (const col of columnRows) {
    if (!columnsByTable.has(col.table_name)) columnsByTable.set(col.table_name, []);
    columnsByTable.get(col.table_name)!.push(col);
  }

  const tursoStatements: { sql: string }[] = [];

  for (const tableName of tableNames) {
    const cols = columnsByTable.get(tableName) ?? [];
    if (cols.length === 0) continue;

    const sqliteCols = cols
      .map((c) => `  "${c.column_name}" ${pgTypeToSqlite(c.data_type, c.udt_name)}`)
      .join(",\n");

    // DROP then CREATE, not CREATE TABLE IF NOT EXISTS.
    //
    // IF NOT EXISTS silently does nothing to a table that already exists, so once a migration
    // added a column to the primary, the Turso archive could never catch up: regenerating and
    // reapplying appeared to work while every insert kept failing with "table X has no column
    // named Y". Twelve tables had drifted this way by 2026-08-16 — profiles.is_test_user,
    // posts.blog_category, vocabulary.transitivity and others — and none of it surfaced while
    // Turso was misconfigured and failing instantly for a different reason.
    //
    // Safe because Turso is a pure snapshot target: db-backup.ts rewrites every row of every
    // table on each run, so there is nothing here to preserve. Apply these immediately before
    // a backup run, never on their own.
    tursoStatements.push({ sql: `DROP TABLE IF EXISTS "${tableName}"` });
    tursoStatements.push({
      sql: `CREATE TABLE "${tableName}" (\n${sqliteCols},\n  "_synced_at" TEXT\n)`,
    });
  }

  writeFileSync("scripts/generated-turso-backup-schema.json", JSON.stringify(tursoStatements, null, 2));

  console.log(`Generated Turso archive schema for ${tableNames.length} tables.`);
  console.log("Turso DDL (as JSON statements) -> scripts/generated-turso-backup-schema.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
