import { getDriverFor, otherProvider } from "./drivers";
import { neonConfigured, supabaseConfigured } from "./providers";
import { resolveActiveProvider, type DbProvider } from "./resolve-provider";
import { TIGHT_REPLICATION_TABLES } from "./replication-poll";

export interface ProviderHealth {
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  error?: string;
}

export interface TableLag {
  table: string;
  lastSyncedAt: string | null;
  lagSeconds: number | null;
  rowsSyncedTotal: number;
  lastError: string | null;
}

async function checkReachable(configured: boolean, provider: DbProvider): Promise<ProviderHealth> {
  if (!configured) return { configured: false, reachable: null, latencyMs: null };
  try {
    const driver = getDriverFor(provider);
    const start = Date.now();
    await driver.query("SELECT 1");
    return { configured: true, reachable: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { configured: true, reachable: false, latencyMs: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function getReplicationLag(standbyProvider: DbProvider, standbyConfigured: boolean): Promise<TableLag[] | null> {
  if (!standbyConfigured) return null;
  try {
    const standby = getDriverFor(standbyProvider);
    const rows = await standby.query(
      `SELECT table_name, last_synced_at, rows_synced_total, last_error FROM replication_poll_state ORDER BY table_name`
    );
    const byTable = new Map(rows.map((r) => [r.table_name as string, r]));
    const now = Date.now();
    return TIGHT_REPLICATION_TABLES.map((table) => {
      const row = byTable.get(table);
      const lastSyncedAt = (row?.last_synced_at as string) ?? null;
      return {
        table,
        lastSyncedAt,
        lagSeconds: lastSyncedAt ? Math.round((now - new Date(lastSyncedAt).getTime()) / 1000) : null,
        rowsSyncedTotal: Number(row?.rows_synced_total ?? 0),
        lastError: (row?.last_error as string) ?? null,
      };
    });
  } catch {
    return null;
  }
}

export interface FailoverStatus {
  activeProvider: DbProvider;
  standbyProvider: DbProvider;
  providers: Record<DbProvider, ProviderHealth>;
  replicationLag: TableLag[] | null;
}

export async function getFailoverStatus(): Promise<FailoverStatus> {
  const activeProvider = await resolveActiveProvider();
  const standbyProvider = otherProvider(activeProvider);
  const neonConf = neonConfigured();
  const supabaseConf = supabaseConfigured();

  const [neonHealth, supabaseHealth] = await Promise.all([
    checkReachable(neonConf, "neon"),
    checkReachable(supabaseConf, "supabase"),
  ]);

  const replicationLag = await getReplicationLag(standbyProvider, standbyProvider === "supabase" ? supabaseConf : neonConf);

  return {
    activeProvider,
    standbyProvider,
    providers: { neon: neonHealth, supabase: supabaseHealth },
    replicationLag,
  };
}
