import { getDriverFor, otherProvider } from "./drivers";
import type { PgDriver } from "./pg-shim";
import { resolveActiveProvider, type DbProvider } from "./resolve-provider";

/** Tier 1: tables kept in near-real-time sync (seconds) between the live Postgres
 * providers — the highest-churn / highest-value data. Everything else is covered by
 * the hourly tier-2 pass (runFullReplicationPass), which uses the identical upsert
 * path; the only difference between the tiers is how often they run.
 *
 * profiles and user_auth are here because they hold user identity. They were missing
 * from this list until 2026-08-14 — see 145_replication_poll_generalize_pk.sql — and
 * had silently diverged (profiles 20 vs 15, user_auth 14 vs 11) because nothing was
 * replicating them. "users" is kept only because it is cheap; it holds 0 rows in both
 * providers and is vestigial. */
export const TIGHT_REPLICATION_TABLES = [
  "profiles",
  "user_auth",
  "orders",
  "order_items",
  "payments",
  "entitlements",
  "users",
  "user_subscriptions",
  "subscription_payments",
  "xp_transactions",
  "points_transactions",
  "quiz_attempts",
  "user_section_progress",
] as const;

/** Control-plane tables that must never be replicated: each provider keeps its own
 * copy (replication cursors, failover state, backup bookkeeping). Copying them would
 * make the standby overwrite its own cursors mid-pass. Mirrors the exclusion list in
 * db-backup.ts getAllTableNames() and schema-parity.ts EXCLUDED_TABLES. */
const NEVER_REPLICATE = new Set([
  "replication_poll_state",
  "db_failover_state",
  "db_failover_log",
  "backup_sync_state",
  "backup_sync_log",
  "sheets_export_state",
]);

// Rows read from the primary per table per pass. 500 suits steady-state polling, where a
// pass should be short. A first backfill after rebuilding a standby has every cursor at
// null and must re-walk whole tables, so raise it (REPLICATION_BATCH_SIZE=5000) to converge
// in a couple of passes instead of ~18. Statement-level chunking keeps any batch size under
// Postgres's parameter limit regardless.
const BATCH_SIZE = Number(process.env.REPLICATION_BATCH_SIZE ?? 500);

interface TablePlan {
  table: string;
  cursorColumn: string;
  /** The table's actual single-column primary key — NOT assumed to be named "id". */
  pkColumn: string;
  /** Postgres type of the PK, e.g. "uuid", "text", "integer". Used to cast the cursor
   * parameter; hard-coding ::uuid is what excluded every text-keyed table before. */
  pkType: string;
  columns: string[];
  /** json/jsonb columns. The primary's driver hands these back as parsed JS values, and
   * node-postgres renders a JS array as a Postgres array literal ({a,b}) rather than JSON
   * — which the standby rejects as "invalid input syntax for type json". These get
   * re-serialised explicitly on the way in. */
  jsonColumns: Set<string>;
}

interface PollResult {
  table: string;
  ok: boolean;
  rowsSynced: number;
  error?: string;
}

/** Resolves a table's primary key from the catalog. Returns null unless there is exactly
 * one PK column — composite keys would need a different cursor predicate, and a table with
 * no PK cannot be upserted at all. Across all 143 tables on this database, every one has a
 * single-column PK, so nothing is skipped for this reason today. */
async function primaryKeyFor(primary: PgDriver, table: string): Promise<{ column: string; type: string } | null> {
  const rows = await primary.query(
    `SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS pk_type
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = format('public.%I', $1::text)::regclass AND i.indisprimary`,
    [table]
  );
  if (rows.length !== 1) return null;
  return { column: rows[0].column_name as string, type: rows[0].pk_type as string };
}

async function planForTable(primary: PgDriver, table: string): Promise<TablePlan | null> {
  const cols = await primary.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  if (cols.length === 0) return null;
  const columnNames = cols.map((c) => c.column_name as string);

  // Use the table's real primary key. This used to require a column literally named "id",
  // which silently excluded every text-keyed table — profiles and user_auth among them.
  const pk = await primaryKeyFor(primary, table);
  if (!pk) return null;

  // Prefer updated_at (catches in-place updates); fall back to created_at (insert-only —
  // in-place updates on such tables won't be caught until the next full hourly backup);
  // last resort, use whichever timestamp column appears first (e.g. user_section_progress's
  // completed_at — an insert-once "when this happened" column, same insert-only caveat).
  let cursorColumn: string | null = null;
  if (columnNames.includes("updated_at")) cursorColumn = "updated_at";
  else if (columnNames.includes("created_at")) cursorColumn = "created_at";
  else {
    const firstTimestampCol = cols.find((c) => (c.data_type as string).startsWith("timestamp"));
    cursorColumn = (firstTimestampCol?.column_name as string) ?? null;
  }
  if (!cursorColumn) return null;

  const jsonColumns = new Set(
    cols.filter((c) => c.data_type === "json" || c.data_type === "jsonb").map((c) => c.column_name as string)
  );

  return { table, cursorColumn, pkColumn: pk.column, pkType: pk.type, columns: columnNames, jsonColumns };
}

/** Prepares one column value for binding on the standby.
 *
 * json/jsonb always needs re-serialising. Both drivers *parse* these columns on the way
 * out, so what arrives is a JS value, never JSON text — and handing that straight back
 * breaks in two different ways:
 *   - an array becomes a Postgres array literal ({a,b}), rejected as invalid json;
 *   - a JSON string arrives as a bare JS string, so jsonb "かく" comes back as かく,
 *     which is not valid JSON text either.
 * Stringifying unconditionally handles objects, arrays, strings, numbers and booleans
 * alike. It cannot double-encode, because a parsed value is never JSON text to begin
 * with. */
function bindValue(value: unknown, isJsonColumn: boolean): unknown {
  if (!isJsonColumn || value === null || value === undefined) return value;
  return JSON.stringify(value);
}

async function ensurePollStateRow(standby: PgDriver, table: string): Promise<void> {
  await standby.query(`INSERT INTO replication_poll_state (table_name) VALUES ($1) ON CONFLICT (table_name) DO NOTHING`, [table]);
}

async function getCursor(standby: PgDriver, table: string): Promise<{ value: string | null; pkValue: string | null }> {
  // Cast to text on the way out — reading a timestamptz through the driver as a JS Date
  // truncates Postgres's microsecond precision to milliseconds (see note below), which
  // would make the cursor perpetually "behind" the true value.
  const rows = await standby.query(
    `SELECT last_cursor_value::text AS last_cursor_value, last_pk_value FROM replication_poll_state WHERE table_name = $1`,
    [table]
  );
  return { value: (rows[0]?.last_cursor_value as string) ?? null, pkValue: (rows[0]?.last_pk_value as string) ?? null };
}

/** One incremental pass for a single table: reads rows newer than the stored cursor from
 * the primary, upserts them into the standby (PK-matched, not the archival insert-then-
 * delete pattern db-backup.ts uses), then advances the cursor. */
async function syncTableOnce(primary: PgDriver, standby: PgDriver, plan: TablePlan): Promise<PollResult> {
  try {
    await ensurePollStateRow(standby, plan.table);
    const cursor = await getCursor(standby, plan.table);

    // Cast the cursor column to text in the SELECT too (__cursor_text) — both drivers
    // parse timestamptz into a JS Date, which only has millisecond precision. Postgres's
    // timestamptz has microsecond precision, so round-tripping through Date would silently
    // truncate it; a row whose true value has any sub-millisecond remainder would then
    // always compare as ">" its own truncated cursor and get "synced" forever, never
    // converging to 0. Keeping the cursor as text end-to-end avoids that entirely.
    // The PK is the tiebreaker within an identical cursor timestamp, and its cast comes
    // from the catalog (plan.pkType) rather than a hard-coded ::uuid. The PK is also
    // selected as text (__pk_text) so it round-trips into last_pk_value regardless of
    // whether it is a uuid, an email, or an integer.
    const pk = `"${plan.pkColumn}"`;
    const rows = cursor.value
      ? await primary.query(
          `SELECT *, "${plan.cursorColumn}"::text AS __cursor_text, ${pk}::text AS __pk_text FROM "${plan.table}"
           WHERE ("${plan.cursorColumn}", ${pk}) > ($1::timestamptz, $2::${plan.pkType})
           ORDER BY "${plan.cursorColumn}", ${pk}
           LIMIT ${BATCH_SIZE}`,
          [cursor.value, cursor.pkValue]
        )
      : await primary.query(
          `SELECT *, "${plan.cursorColumn}"::text AS __cursor_text, ${pk}::text AS __pk_text FROM "${plan.table}"
           ORDER BY "${plan.cursorColumn}", ${pk} LIMIT ${BATCH_SIZE}`
        );

    if (rows.length === 0) return { table: plan.table, ok: true, rowsSynced: 0 };

    const cols = plan.columns;
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const updateList = cols
      .filter((c) => c !== plan.pkColumn)
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");
    // A table whose only column is its PK has nothing to update; "DO UPDATE SET" with an
    // empty list is a syntax error, so degrade to DO NOTHING (the row is already there).
    const onConflict = updateList ? `DO UPDATE SET ${updateList}` : "DO NOTHING";

    // Multi-row INSERT rather than one statement per row. This used to be a per-row loop,
    // which meant a 500-row batch cost 500 sequential round trips to the standby — at
    // cross-region latency (~200ms) a single full-tier pass took over an hour, and could
    // never have completed inside a serverless function's timeout.
    //
    // Chunked to stay under Postgres's 65535 bound parameters per statement; wide tables
    // get proportionally fewer rows per statement.
    const maxRowsPerStatement = Math.max(1, Math.floor(30_000 / cols.length));
    for (let i = 0; i < rows.length; i += maxRowsPerStatement) {
      const chunk = rows.slice(i, i + maxRowsPerStatement);
      const values: unknown[] = [];
      const tuples = chunk.map((row) => {
        const placeholders = cols.map((c) => {
          values.push(bindValue(row[c], plan.jsonColumns.has(c)));
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });

      // Replication copies a consistent snapshot table by table, so a child row can land
      // before its parent (video_events references video_renders, and "events" sorts
      // first). session_replication_role = replica suppresses FK and user triggers for the
      // duration — the standard way to load replicated data — and referential integrity
      // still holds once the pass completes, because the source enforced it.
      // SET LOCAL requires a transaction, which also pins these statements to one
      // connection; a bare SET on a pooled driver could land on a different one.
      await standby.transaction(async (tx) => {
        await tx.query("SET LOCAL session_replication_role = replica");
        await tx.query(
          `INSERT INTO "${plan.table}" (${colList}) VALUES ${tuples.join(", ")}
           ON CONFLICT (${pk}) ${onConflict}`,
          values
        );
      });
    }

    const last = rows[rows.length - 1];
    await standby.query(
      `UPDATE replication_poll_state
       SET last_cursor_value = $2::timestamptz, last_pk_value = $3, last_synced_at = NOW(),
           rows_synced_total = rows_synced_total + $4, last_error = NULL
       WHERE table_name = $1`,
      [plan.table, last.__cursor_text, last.__pk_text, rows.length]
    );

    return { table: plan.table, ok: true, rowsSynced: rows.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown replication-poll error";
    await standby
      .query(`UPDATE replication_poll_state SET last_error = $2 WHERE table_name = $1`, [plan.table, error])
      .catch(() => undefined);
    return { table: plan.table, ok: false, rowsSynced: 0, error };
  }
}

/** Runs one pass across every tight-replication table, primary -> standby (direction
 * follows whichever provider is currently active). Intended to be called repeatedly —
 * but by the *scheduler*, not by looping inside one request: Netlify kills functions at
 * ~10s, so /api/cron/replication-poll now does roughly one pass per invocation and
 * .github/workflows/crons.yml (or n8n) calls it several times per run. */
export async function runReplicationPollPass(): Promise<{ primary: DbProvider; standby: DbProvider; results: PollResult[] }> {
  return runPassOver([...TIGHT_REPLICATION_TABLES]);
}

/** Tier 2: one pass across every replicable table in the primary, not just the tight tier.
 * Same PK-matched upsert path — only the cadence differs (hourly, vs seconds for tier 1).
 *
 * This replaces the Supabase half of db-backup.ts's snapshot writer, which used an
 * insert-then-delete pattern that only worked because the standby's tables had no primary
 * keys. Now that the standby is a true schema replica, that pattern would conflict on
 * every row; the upsert path here is the correct mechanism. Turso and R2 still get full
 * PK-less snapshots from db-backup.ts, which is right for an archive.
 *
 * Note the first run backfills from scratch (every cursor starts null) and moves a lot of
 * rows — expect it to take several passes to converge, since each table advances by at
 * most BATCH_SIZE per pass. */
export async function runFullReplicationPass(
  opts: { offset?: number; limit?: number } = {}
): Promise<{ primary: DbProvider; standby: DbProvider; results: PollResult[]; totalTables: number; nextOffset: number; done: boolean }> {
  const primaryProvider = await resolveActiveProvider();
  const primary = getDriverFor(primaryProvider);
  const rows = await primary.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  );
  const all = rows.map((r) => r.table_name as string).filter((t) => !NEVER_REPLICATE.has(t));

  // Resumable in slices. Planning a table costs ~5 round trips before a single row moves,
  // so 137 tables is minutes of latency even when there is nothing to sync — well past a
  // serverless function's timeout. The caller drains this the same way it drains
  // backup-sync: call repeatedly with nextOffset until done. Omitting offset/limit
  // processes everything in one go, which is what the CLI script does.
  const offset = opts.offset ?? 0;
  const slice = opts.limit ? all.slice(offset, offset + opts.limit) : all.slice(offset);
  const pass = await runPassOver(slice);
  const nextOffset = offset + slice.length;

  return { ...pass, totalTables: all.length, nextOffset, done: nextOffset >= all.length };
}

async function runPassOver(tables: string[]): Promise<{ primary: DbProvider; standby: DbProvider; results: PollResult[] }> {
  const primaryProvider = await resolveActiveProvider();
  const standbyProvider = otherProvider(primaryProvider);
  const primary = getDriverFor(primaryProvider);
  const standby = getDriverFor(standbyProvider);

  const results: PollResult[] = [];
  for (const table of tables) {
    const plan = await planForTable(primary, table);
    if (!plan) {
      results.push({
        table,
        ok: false,
        rowsSynced: 0,
        error: "not replicable: needs a single-column primary key and a timestamp cursor column",
      });
      continue;
    }
    results.push(await syncTableOnce(primary, standby, plan));
  }
  return { primary: primaryProvider, standby: standbyProvider, results };
}
