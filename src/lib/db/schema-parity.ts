import { getDriverFor } from "./drivers";

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface SchemaSnapshot {
  tables: Set<string>;
  columns: Map<string, ColumnInfo[]>;
}

export interface ColumnMismatch {
  table: string;
  issue: string;
}

export interface ParityDiff {
  missingInSupabase: string[];
  missingInNeon: string[];
  columnMismatches: ColumnMismatch[];
  ok: boolean;
}

// Control-plane / backup-only tables that don't need to match 1:1 between
// providers (e.g. db-backup.ts's own bookkeeping tables).
const EXCLUDED_TABLES = new Set([
  "backup_sync_state",
  "backup_sync_log",
  "replication_poll_state",
  "sheets_export_state",
]);

function toSnapshot(tableRows: { table_name: string }[], columnRows: ColumnInfo[]): SchemaSnapshot {
  const tables = new Set(tableRows.map((r) => r.table_name).filter((t) => !EXCLUDED_TABLES.has(t)));
  const columns = new Map<string, ColumnInfo[]>();
  for (const col of columnRows) {
    if (!tables.has(col.table_name)) continue;
    if (!columns.has(col.table_name)) columns.set(col.table_name, []);
    columns.get(col.table_name)!.push(col);
  }
  return { tables, columns };
}

async function fetchSchema(provider: "neon" | "supabase"): Promise<SchemaSnapshot> {
  const driver = getDriverFor(provider);
  const tableRows = await driver.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const columnRows = await driver.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  return toSnapshot(tableRows as { table_name: string }[], columnRows as ColumnInfo[]);
}

export const fetchNeonSchema = () => fetchSchema("neon");
export const fetchSupabaseSchema = () => fetchSchema("supabase");

/** Pure diff, no I/O — used both by the CLI (scripts/check-schema-parity.ts) and the
 * admin failover status endpoint. */
export function diffSchemas(neonSchema: SchemaSnapshot, supabaseSchema: SchemaSnapshot): ParityDiff {
  const missingInSupabase = Array.from(neonSchema.tables)
    .filter((t) => !supabaseSchema.tables.has(t))
    .sort();
  const missingInNeon = Array.from(supabaseSchema.tables)
    .filter((t) => !neonSchema.tables.has(t))
    .sort();
  const commonTables = Array.from(neonSchema.tables).filter((t) => supabaseSchema.tables.has(t));

  const columnMismatches: ColumnMismatch[] = [];
  for (const table of commonTables) {
    const neonCols = new Map((neonSchema.columns.get(table) ?? []).map((c) => [c.column_name, c]));
    const supabaseCols = new Map((supabaseSchema.columns.get(table) ?? []).map((c) => [c.column_name, c]));

    Array.from(neonCols.entries()).forEach(([name, col]) => {
      const other = supabaseCols.get(name);
      if (!other) {
        columnMismatches.push({ table, issue: `column "${name}" missing in Supabase` });
        return;
      }
      if (col.data_type !== other.data_type) {
        columnMismatches.push({ table, issue: `column "${name}" type differs: neon=${col.data_type} supabase=${other.data_type}` });
      }
      if (col.is_nullable !== other.is_nullable) {
        columnMismatches.push({ table, issue: `column "${name}" nullability differs: neon=${col.is_nullable} supabase=${other.is_nullable}` });
      }
    });
    Array.from(supabaseCols.keys()).forEach((name) => {
      if (!neonCols.has(name)) columnMismatches.push({ table, issue: `column "${name}" missing in Neon` });
    });
  }

  return {
    missingInSupabase,
    missingInNeon,
    columnMismatches,
    ok: missingInSupabase.length === 0 && missingInNeon.length === 0 && columnMismatches.length === 0,
  };
}
