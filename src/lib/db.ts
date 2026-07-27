import type { PgDriver } from "@/lib/db/pg-shim";
import { neonConfigured, supabaseConfigured } from "@/lib/db/providers";
import { getDriverFor } from "@/lib/db/drivers";
import { resolveActiveProvider } from "@/lib/db/resolve-provider";

export const useNeon = neonConfigured();

/** Resolves which driver should serve this call. Supabase is only ever selected
 * once SUPABASE_DATABASE_URL is configured — until then this always resolves to
 * Neon synchronously, with no Turso lookup, matching today's behavior exactly. */
async function getActiveDriver(): Promise<PgDriver> {
  if (!supabaseConfigured()) return getDriverFor("neon");
  if (!neonConfigured()) return getDriverFor("supabase");
  const provider = await resolveActiveProvider();
  return getDriverFor(provider);
}

const configured = neonConfigured() || supabaseConfigured();

/** Callable/queryable facade routed to whichever Postgres provider is currently
 * active. Created once and never reassigned — every one of the ~300 existing
 * `import { sql } from "@/lib/db"` call sites keeps working unchanged; only the
 * driver it delegates to can change at runtime. */
export const sql: PgDriver | null = configured
  ? (new Proxy(function sqlFacade() {} as unknown as PgDriver, {
      apply: async (_target, _thisArg, args: [TemplateStringsArray, ...unknown[]]) => {
        const driver = await getActiveDriver();
        return driver(...args);
      },
      get: (_target, prop) => {
        if (prop === "query") {
          return async (text: string, params?: unknown[]) => {
            const driver = await getActiveDriver();
            return driver.query(text, params);
          };
        }
        if (prop === "transaction") {
          return async <T>(fn: (tx: PgDriver) => Promise<T>) => {
            const driver = await getActiveDriver();
            return driver.transaction(fn);
          };
        }
        return undefined;
      },
    }))
  : null;
