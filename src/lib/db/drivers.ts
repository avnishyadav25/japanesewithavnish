import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { createPgDriver, type PgDriver } from "./pg-shim";
import { getSupabasePool, neonConfigured, supabaseConfigured } from "./providers";
import type { DbProvider } from "./resolve-provider";

let neonDriver: PgDriver | null = null;
let supabaseDriver: PgDriver | null = null;
let neonTxPool: Pool | null = null;

/**
 * A pooled Neon connection, created only when an interactive transaction is actually needed.
 *
 * WHY THIS EXISTS: `neon()` returns an HTTP driver, and HTTP cannot hold an interactive
 * transaction — each request is its own implicit one. Neon's own `.transaction()` therefore takes
 * an ARRAY of queries, not a callback, so the `as unknown as PgDriver` cast below was a lie that
 * typechecked: `PgDriver.transaction` is declared callback-style, and calling it threw
 * "transaction() expects an array of queries" at runtime. `npm run db:migrate` had never once
 * succeeded against Neon because of it.
 *
 * Only the transaction path pays for this. Ordinary queries — the ~300 tagged-template call sites
 * — keep going over HTTP, which is what makes them fast from a Netlify function.
 *
 * DATABASE_URL_DIRECT by preference: this path exists for DDL, and Neon's pooler endpoint is the
 * wrong side of a connection pooler to be running schema changes through.
 */
function neonTransactionDriver(): PgDriver {
  if (!neonTxPool) {
    const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Neon not configured (DATABASE_URL missing)");
    neonTxPool = new Pool({ connectionString, max: 2 });
  }
  return createPgDriver(neonTxPool);
}

/** Gets a driver for a *specific* named provider (not "whichever is active") —
 * needed anywhere that has to talk to both sides at once: the polling sync
 * (reads primary, writes standby) and the switch/rejoin admin routes. */
export function getDriverFor(provider: DbProvider): PgDriver {
  if (provider === "neon") {
    if (!neonConfigured()) throw new Error("Neon not configured (DATABASE_URL missing)");
    if (!neonDriver) {
      const http = neon(process.env.DATABASE_URL!) as unknown as PgDriver;
      // Replaces Neon's array-form transaction() with the callback form PgDriver declares.
      // Nothing in this codebase uses the array form; see the note on neonTransactionDriver.
      http.transaction = <T>(fn: (tx: PgDriver) => Promise<T>): Promise<T> =>
        neonTransactionDriver().transaction(fn);
      neonDriver = http;
    }
    return neonDriver;
  }
  if (!supabaseConfigured()) throw new Error("Supabase not configured (SUPABASE_DATABASE_URL missing)");
  if (!supabaseDriver) supabaseDriver = createPgDriver(getSupabasePool());
  return supabaseDriver;
}

export function otherProvider(provider: DbProvider): DbProvider {
  return provider === "neon" ? "supabase" : "neon";
}
