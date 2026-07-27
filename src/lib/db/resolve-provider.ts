import { tursoConfigured, tursoExecute } from "./turso-client";

export type DbProvider = "neon" | "supabase";

const CACHE_TTL_MS = 5_000;
const FALLBACK_PROVIDER: DbProvider = process.env.DB_PROVIDER_FALLBACK === "supabase" ? "supabase" : "neon";

let cache: { provider: DbProvider; resolvedAt: number } | null = null;

function isDbProvider(value: unknown): value is DbProvider {
  return value === "neon" || value === "supabase";
}

async function readActiveProviderFromTurso(): Promise<DbProvider | null> {
  if (!tursoConfigured()) return null;
  try {
    const rows = await tursoExecute("SELECT active_provider FROM db_failover_flag WHERE id = 1");
    const value = rows[0]?.active_provider;
    return isDbProvider(value) ? value : null;
  } catch (e) {
    console.error("resolve-provider: Turso read failed", e);
    return null;
  }
}

/** Resolves which Postgres provider is currently "active" for app traffic.
 * Cached briefly (CACHE_TTL_MS) to avoid a Turso round trip on every query. On a
 * Turso read failure, falls back to the last known-good cached value rather than
 * guessing; with no cache at all (cold start + Turso down), falls back to
 * DB_PROVIDER_FALLBACK (default "neon"). */
export async function resolveActiveProvider(): Promise<DbProvider> {
  const now = Date.now();
  if (cache && now - cache.resolvedAt < CACHE_TTL_MS) return cache.provider;

  const fromTurso = await readActiveProviderFromTurso();
  const provider = fromTurso ?? cache?.provider ?? FALLBACK_PROVIDER;
  cache = { provider, resolvedAt: now };
  return provider;
}

/** Call right after flipping the flag (admin switch action) so this warm instance
 * doesn't keep serving the stale provider for the remainder of the cache TTL. */
export function invalidateProviderCache(): void {
  cache = null;
}

async function ensureFailoverFlagTable(): Promise<void> {
  await tursoExecute(`CREATE TABLE IF NOT EXISTS db_failover_flag (id INTEGER PRIMARY KEY, active_provider TEXT NOT NULL DEFAULT 'neon')`);
  await tursoExecute(`INSERT OR IGNORE INTO db_failover_flag (id, active_provider) VALUES (1, 'neon')`);
}

/** The actual cutover: flips the routing flag in Turso, then invalidates this
 * instance's cache so it stops serving the old provider immediately (other warm
 * instances catch up within CACHE_TTL_MS — the accepted bounded-staleness window). */
export async function setActiveProviderInTurso(provider: DbProvider): Promise<void> {
  await ensureFailoverFlagTable();
  await tursoExecute(
    `INSERT INTO db_failover_flag (id, active_provider) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET active_provider = excluded.active_provider`,
    [provider]
  );
  invalidateProviderCache();
}
