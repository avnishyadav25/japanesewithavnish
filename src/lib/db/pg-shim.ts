import type { Pool, PoolClient } from "pg";

/** Matches the shape of what @neondatabase/serverless's neon() returns closely
 * enough for this codebase's usage: callable as a tagged template (returns rows
 * directly), plus .query(text, params) (also rows directly) and .transaction().
 * Rows are typed `Record<string, any>[]`, same as Neon's own QueryRows type —
 * keeping this loose (not `unknown`) matters: it's what the ~300 existing call
 * sites already assume, and tightening it here would surface unrelated
 * pre-existing implicit-any assumptions across the codebase as new errors. */
export interface PgDriver {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, any>[]>;
  query(text: string, params?: unknown[]): Promise<Record<string, any>[]>;
  transaction<T>(fn: (tx: PgDriver) => Promise<T>): Promise<T>;
}

interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, any>[] }>;
}

function buildTaggedQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return { text, params: values };
}

function driverFromQueryable(queryable: Queryable): PgDriver {
  const driver = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, params } = buildTaggedQuery(strings, values);
    const result = await queryable.query(text, params);
    return result.rows;
  }) as PgDriver;

  driver.query = async (text: string, params: unknown[] = []) => {
    const result = await queryable.query(text, params);
    return result.rows;
  };

  driver.transaction = async <T>(fn: (tx: PgDriver) => Promise<T>): Promise<T> => {
    // Only reachable when `queryable` is a Pool (transactions can't nest); check it out a client.
    const pool = queryable as unknown as Pool;
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(driverFromQueryable(client));
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };

  return driver;
}

/** Wraps a pg.Pool so callers get the same `sql\`...\`` / sql.query() / sql.transaction()
 * interface the app already uses against Neon's native driver — no call-site changes needed. */
export function createPgDriver(pool: Pool): PgDriver {
  return driverFromQueryable(pool);
}
