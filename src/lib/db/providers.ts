import { Pool } from "pg";
import type { DbProvider } from "./resolve-provider";

export function neonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** True once a pooled Supabase app-query connection has been provisioned. Until
 * then, Supabase is never selectable as the active provider — this is what keeps
 * the rollout Neon-only until the env var is deliberately added. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_DATABASE_URL);
}

// Cached on globalThis so warm serverless invocations reuse pools instead of
// reconnecting on every request (standard pattern for pg.Pool in Next.js).
declare global {
  // eslint-disable-next-line no-var
  var __jwaSupabasePool: Pool | undefined;
}

export function getSupabasePool(): Pool {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) throw new Error("SUPABASE_DATABASE_URL not configured");
  if (!globalThis.__jwaSupabasePool) {
    globalThis.__jwaSupabasePool = new Pool({
      connectionString,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalThis.__jwaSupabasePool;
}

/** Direct (non-pooled) connection strings — for replication DDL / schema-parity
 * checks only. Never used for app query traffic. */
export function getDirectConnectionString(provider: DbProvider): string | null {
  if (provider === "neon") return process.env.DATABASE_URL_DIRECT || null;
  // SUPABASE_DB_URL already points at Supabase's direct (port 5432) host.
  return process.env.SUPABASE_DB_URL || null;
}
