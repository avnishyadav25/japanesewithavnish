import { getDriverFor, otherProvider } from "./drivers";
import type { PgDriver } from "./pg-shim";
import { resolveActiveProvider, type DbProvider } from "./resolve-provider";

/** Tables kept in near-real-time sync between the live Postgres providers. Everything
 * else stays on the existing hourly full-backup cadence in db-backup.ts — these are the
 * highest-churn / highest-value tables (payments, progress, gamification). */
export const TIGHT_REPLICATION_TABLES = [
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

const BATCH_SIZE = 500;

interface TablePlan {
  table: string;
  cursorColumn: string;
  columns: string[];
}

interface PollResult {
  table: string;
  ok: boolean;
  rowsSynced: number;
  error?: string;
}

async function planForTable(primary: PgDriver, table: string): Promise<TablePlan | null> {
  const cols = await primary.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  if (cols.length === 0) return null;
  const columnNames = cols.map((c) => c.column_name as string);
  if (!columnNames.includes("id")) return null;

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
  return { table, cursorColumn, columns: columnNames };
}

async function ensurePollStateRow(standby: PgDriver, table: string): Promise<void> {
  await standby.query(`INSERT INTO replication_poll_state (table_name) VALUES ($1) ON CONFLICT (table_name) DO NOTHING`, [table]);
}

async function getCursor(standby: PgDriver, table: string): Promise<{ value: string | null; rowId: string | null }> {
  // Cast to text on the way out — reading a timestamptz through the driver as a JS Date
  // truncates Postgres's microsecond precision to milliseconds (see note below), which
  // would make the cursor perpetually "behind" the true value.
  const rows = await standby.query(
    `SELECT last_cursor_value::text AS last_cursor_value, last_row_id FROM replication_poll_state WHERE table_name = $1`,
    [table]
  );
  return { value: (rows[0]?.last_cursor_value as string) ?? null, rowId: (rows[0]?.last_row_id as string) ?? null };
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
    const rows = cursor.value
      ? await primary.query(
          `SELECT *, "${plan.cursorColumn}"::text AS __cursor_text FROM "${plan.table}"
           WHERE ("${plan.cursorColumn}", id) > ($1::timestamptz, $2::uuid)
           ORDER BY "${plan.cursorColumn}", id
           LIMIT ${BATCH_SIZE}`,
          [cursor.value, cursor.rowId]
        )
      : await primary.query(
          `SELECT *, "${plan.cursorColumn}"::text AS __cursor_text FROM "${plan.table}"
           ORDER BY "${plan.cursorColumn}", id LIMIT ${BATCH_SIZE}`
        );

    if (rows.length === 0) return { table: plan.table, ok: true, rowsSynced: 0 };

    const cols = plan.columns;
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const updateList = cols
      .filter((c) => c !== "id")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const values = cols.map((c) => row[c]);
      await standby.query(
        `INSERT INTO "${plan.table}" (${colList}) VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET ${updateList}`,
        values
      );
    }

    const last = rows[rows.length - 1];
    await standby.query(
      `UPDATE replication_poll_state
       SET last_cursor_value = $2::timestamptz, last_row_id = $3::uuid, last_synced_at = NOW(),
           rows_synced_total = rows_synced_total + $4, last_error = NULL
       WHERE table_name = $1`,
      [plan.table, last.__cursor_text, last.id, rows.length]
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
  const primaryProvider = await resolveActiveProvider();
  const standbyProvider = otherProvider(primaryProvider);
  const primary = getDriverFor(primaryProvider);
  const standby = getDriverFor(standbyProvider);

  const results: PollResult[] = [];
  for (const table of TIGHT_REPLICATION_TABLES) {
    const plan = await planForTable(primary, table);
    if (!plan) {
      results.push({ table, ok: false, rowsSynced: 0, error: "table missing id/cursor column on primary" });
      continue;
    }
    results.push(await syncTableOnce(primary, standby, plan));
  }
  return { primary: primaryProvider, standby: standbyProvider, results };
}
