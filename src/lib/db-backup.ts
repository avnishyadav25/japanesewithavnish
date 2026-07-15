import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db";

const BATCH_SIZE = 5;

function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

async function getAllTableNames(): Promise<string[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('backup_sync_state', 'backup_sync_log')
    ORDER BY table_name
  `) as { table_name: string }[];
  return rows.map((r) => r.table_name);
}

type WriteResult = { ok: boolean; error?: string };

/** Writes an exact-schema replica of `rows` into `<tableName>` in Supabase (real
 * Postgres, generated schema in scripts/generated-supabase-backup-schema.sql). Inserts
 * the fresh snapshot first, then deletes anything older than this run — avoids any
 * window where the backup table is empty, without needing a primary key to upsert on
 * (the generated schema intentionally has none, to avoid cross-database PK conflicts). */
async function writeToSupabase(tableName: string, rows: Record<string, unknown>[], runStartedAt: string): Promise<WriteResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase not configured" };

  try {
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((row) => ({ ...row, _synced_at: runStartedAt }));
      const insertRes = await fetch(`${url}/rest/v1/${tableName}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!insertRes.ok) {
        const text = await insertRes.text();
        return { ok: false, error: `insert ${insertRes.status}: ${text.slice(0, 300)}` };
      }
    }

    const deleteRes = await fetch(
      `${url}/rest/v1/${tableName}?_synced_at=lt.${encodeURIComponent(runStartedAt)}`,
      { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!deleteRes.ok) {
      const text = await deleteRes.text();
      return { ok: false, error: `cleanup delete ${deleteRes.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Supabase error" };
  }
}

type TursoArg = { type: "text" | "integer" | "null"; value?: string };

function toTursoArg(value: unknown): TursoArg {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number" && Number.isInteger(value)) return { type: "integer", value: String(value) };
  if (typeof value === "object") return { type: "text", value: JSON.stringify(value) };
  return { type: "text", value: String(value) };
}

/** Writes an exact-schema replica into `<tableName>` in Turso (SQLite, schema
 * generated in scripts/generated-turso-backup-schema.json). Same insert-then-cleanup
 * pattern as Supabase. Row inserts for one table are batched into a single pipeline
 * HTTP call (chunked at 200 statements) rather than one request per row. */
async function writeToTurso(tableName: string, rows: Record<string, unknown>[], runStartedAt: string): Promise<WriteResult> {
  const dbUrl = process.env.TURSO_DB_URL;
  const token = process.env.TURSO_DB_AUTH_TOKEN;
  if (!dbUrl || !token) return { ok: false, error: "Turso not configured" };
  const httpUrl = dbUrl.replace(/^libsql:\/\//, "https://");

  try {
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const requests = chunk.map((row) => {
        const cols = [...Object.keys(row), "_synced_at"];
        const placeholders = cols.map(() => "?").join(",");
        const quotedCols = cols.map((c) => `"${c}"`).join(",");
        const args = [...Object.values(row).map(toTursoArg), { type: "text" as const, value: runStartedAt }];
        return {
          type: "execute",
          stmt: { sql: `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`, args },
        };
      });
      requests.push({ type: "close" } as unknown as (typeof requests)[number]);

      const res = await fetch(`${httpUrl}/v2/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });
      if (!res.ok) return { ok: false, error: `insert chunk ${res.status}: ${(await res.text()).slice(0, 300)}` };
      const data = await res.json();
      const errored = (data.results as { type: string; error?: { message?: string } }[]).find((r) => r.type === "error");
      if (errored) return { ok: false, error: errored.error?.message ?? "Unknown Turso insert error" };
    }

    const cleanupRes = await fetch(`${httpUrl}/v2/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: `DELETE FROM "${tableName}" WHERE "_synced_at" < ?`, args: [{ type: "text", value: runStartedAt }] } },
          { type: "close" },
        ],
      }),
    });
    if (!cleanupRes.ok) return { ok: false, error: `cleanup ${cleanupRes.status}` };
    const cleanupData = await cleanupRes.json();
    if (cleanupData.results?.[0]?.type === "error") {
      return { ok: false, error: cleanupData.results[0].error?.message ?? "Unknown Turso cleanup error" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Turso error" };
  }
}

async function writeToR2(tableName: string, rows: unknown[], runStartedAt: string): Promise<WriteResult> {
  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!r2 || !bucket) return { ok: false, error: "R2 not configured" };
  try {
    const key = `db-backups/${tableName}.json`;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify({ table_name: tableName, row_count: rows.length, run_started_at: runStartedAt, rows }),
        ContentType: "application/json",
      })
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown R2 error" };
  }
}

export type BackupSyncResult = {
  status: "running" | "completed" | "error";
  totalTables: number;
  processedThisCall: number;
  nextOffset: number;
  runStartedAt: string;
  tablesSyncedOk: number;
  tablesSyncedFailed: number;
};

/** Processes one batch of tables (BATCH_SIZE at a time) in the full-database backup
 * sync, resuming from backup_sync_state's cursor. Call repeatedly (e.g. every few
 * minutes via cron) until status is "completed". Writes each table's full row set to
 * Supabase, Turso, and R2 as exact-schema, exact-name replicas, and logs per-table
 * results (including the real error message on failure) to backup_sync_log. */
export async function runBackupSyncBatch(force = false): Promise<BackupSyncResult | { status: "idle"; nextRunAt: string }> {
  if (!sql) throw new Error("Database not configured");

  const stateRows = (await sql`SELECT * FROM backup_sync_state WHERE id = 1`) as {
    status: string;
    run_started_at: string | null;
    run_completed_at: string | null;
    total_tables: number;
    next_table_offset: number;
    tables_synced_ok: number;
    tables_synced_failed: number;
  }[];
  const state = stateRows[0];

  // Unless forced (manual "Sync Now"), don't start a new full run within ~20h of the
  // last completion — keeps the cron ping (every few minutes) from re-triggering a
  // full sync repeatedly once the nightly run already finished.
  if (!force && state?.status === "completed" && state.run_completed_at) {
    const hoursSinceCompletion = (Date.now() - new Date(state.run_completed_at).getTime()) / 3_600_000;
    if (hoursSinceCompletion < 20) {
      const nextRunAt = new Date(new Date(state.run_completed_at).getTime() + 20 * 3_600_000).toISOString();
      return { status: "idle", nextRunAt };
    }
  }

  const startingNewRun = !state || state.status !== "running";
  let runStartedAt: string;
  let allTables: string[];
  let offset: number;
  let okCount: number;
  let failCount: number;

  if (startingNewRun) {
    allTables = await getAllTableNames();
    runStartedAt = new Date().toISOString();
    offset = 0;
    okCount = 0;
    failCount = 0;
    await sql`
      UPDATE backup_sync_state SET
        status = 'running', run_started_at = ${runStartedAt}, run_completed_at = NULL,
        total_tables = ${allTables.length}, next_table_offset = 0,
        tables_synced_ok = 0, tables_synced_failed = 0, last_error = NULL, updated_at = NOW()
      WHERE id = 1
    `;
  } else {
    allTables = await getAllTableNames();
    // Neon returns timestamptz columns as JS Date objects, not strings (despite the
    // schema type). Re-normalizing through Date here avoids a Date.toString() (local
    // timezone, e.g. "GMT+0530") leaking into the Supabase cleanup-delete URL below,
    // which PostgREST rejects as an invalid timestamp.
    runStartedAt = new Date(state.run_started_at as string).toISOString();
    offset = state.next_table_offset;
    okCount = state.tables_synced_ok;
    failCount = state.tables_synced_failed;
  }

  const batch = allTables.slice(offset, offset + BATCH_SIZE);

  for (const tableName of batch) {
    try {
      // tableName comes from information_schema.tables (trusted, not user input), so
      // identifier-quoting it and interpolating is safe — sql`` tags can't parameterize
      // identifiers, only values.
      const quotedTable = `"${tableName.replace(/"/g, '""')}"`;
      const rows: Record<string, unknown>[] = [];
      const PAGE_SIZE = 5000;
      for (let pageOffset = 0; ; pageOffset += PAGE_SIZE) {
        const page = (await sql.query(
          `SELECT * FROM ${quotedTable} LIMIT ${PAGE_SIZE} OFFSET ${pageOffset}`,
          []
        )) as Record<string, unknown>[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      const [supabaseResult, tursoResult, r2Result] = await Promise.all([
        writeToSupabase(tableName, rows, runStartedAt),
        writeToTurso(tableName, rows, runStartedAt),
        writeToR2(tableName, rows, runStartedAt),
      ]);
      const tableOk = supabaseResult.ok && tursoResult.ok && r2Result.ok;
      if (tableOk) okCount++;
      else failCount++;

      const errorParts = [
        !supabaseResult.ok ? `supabase: ${supabaseResult.error}` : null,
        !tursoResult.ok ? `turso: ${tursoResult.error}` : null,
        !r2Result.ok ? `r2: ${r2Result.error}` : null,
      ].filter(Boolean);

      await sql`
        INSERT INTO backup_sync_log (run_started_at, table_name, row_count, supabase_ok, turso_ok, r2_ok, error)
        VALUES (${runStartedAt}, ${tableName}, ${rows.length}, ${supabaseResult.ok}, ${tursoResult.ok}, ${r2Result.ok}, ${errorParts.length ? errorParts.join(" | ") : null})
      `;
    } catch (e) {
      failCount++;
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      await sql`
        INSERT INTO backup_sync_log (run_started_at, table_name, row_count, supabase_ok, turso_ok, r2_ok, error)
        VALUES (${runStartedAt}, ${tableName}, 0, false, false, false, ${errMsg})
      `;
    }
  }

  const newOffset = offset + batch.length;
  const isComplete = newOffset >= allTables.length;

  await sql`
    UPDATE backup_sync_state SET
      status = ${isComplete ? "completed" : "running"},
      run_completed_at = ${isComplete ? new Date().toISOString() : null},
      next_table_offset = ${newOffset},
      tables_synced_ok = ${okCount},
      tables_synced_failed = ${failCount},
      updated_at = NOW()
    WHERE id = 1
  `;

  return {
    status: isComplete ? "completed" : "running",
    totalTables: allTables.length,
    processedThisCall: batch.length,
    nextOffset: newOffset,
    runStartedAt,
    tablesSyncedOk: okCount,
    tablesSyncedFailed: failCount,
  };
}
