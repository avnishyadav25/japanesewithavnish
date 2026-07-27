import { neon } from "@neondatabase/serverless";
import { createPgDriver, type PgDriver } from "./pg-shim";
import { getSupabasePool, neonConfigured, supabaseConfigured } from "./providers";
import type { DbProvider } from "./resolve-provider";

let neonDriver: PgDriver | null = null;
let supabaseDriver: PgDriver | null = null;

/** Gets a driver for a *specific* named provider (not "whichever is active") —
 * needed anywhere that has to talk to both sides at once: the polling sync
 * (reads primary, writes standby) and the switch/rejoin admin routes. */
export function getDriverFor(provider: DbProvider): PgDriver {
  if (provider === "neon") {
    if (!neonConfigured()) throw new Error("Neon not configured (DATABASE_URL missing)");
    if (!neonDriver) neonDriver = neon(process.env.DATABASE_URL!) as unknown as PgDriver;
    return neonDriver;
  }
  if (!supabaseConfigured()) throw new Error("Supabase not configured (SUPABASE_DATABASE_URL missing)");
  if (!supabaseDriver) supabaseDriver = createPgDriver(getSupabasePool());
  return supabaseDriver;
}

export function otherProvider(provider: DbProvider): DbProvider {
  return provider === "neon" ? "supabase" : "neon";
}
