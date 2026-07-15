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

/** Postgres CREATE TABLE for Supabase is a near-direct copy of Neon's schema, just
 * dropping constraints/FKs (this is a backup target, not a live replica needing
 * referential integrity to other tables it doesn't have). */
function pgTypeToSupabase(dataType: string, udtName: string): string {
  if (dataType === "ARRAY") {
    const elementType = udtName.startsWith("_") ? udtName.slice(1) : "text";
    return `${elementType}[]`;
  }
  return dataType === "USER-DEFINED" ? "text" : dataType;
}

async function main() {
  const tableRows = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('backup_sync_state', 'backup_sync_log')
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

  const supabaseStatements: string[] = [];
  const tursoStatements: { sql: string }[] = [];

  for (const tableName of tableNames) {
    const cols = columnsByTable.get(tableName) ?? [];
    if (cols.length === 0) continue;

    // Supabase (Postgres)
    const pgCols = cols
      .map((c) => `  "${c.column_name}" ${pgTypeToSupabase(c.data_type, c.udt_name)}`)
      .join(",\n");
    supabaseStatements.push(
      `DROP TABLE IF EXISTS "${tableName}";\nCREATE TABLE "${tableName}" (\n${pgCols},\n  "_synced_at" timestamptz DEFAULT now()\n);`
    );

    // Turso (SQLite)
    const sqliteCols = cols
      .map((c) => `  "${c.column_name}" ${pgTypeToSqlite(c.data_type, c.udt_name)}`)
      .join(",\n");
    tursoStatements.push({
      sql: `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${sqliteCols},\n  "_synced_at" TEXT\n)`,
    });
  }

  writeFileSync("scripts/generated-supabase-backup-schema.sql", supabaseStatements.join("\n\n") + "\n");
  writeFileSync("scripts/generated-turso-backup-schema.json", JSON.stringify(tursoStatements, null, 2));

  console.log(`Generated schema for ${tableNames.length} tables.`);
  console.log("Supabase DDL -> scripts/generated-supabase-backup-schema.sql");
  console.log("Turso DDL (as JSON statements) -> scripts/generated-turso-backup-schema.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
