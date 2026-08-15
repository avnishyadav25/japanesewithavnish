import { buildTaggedQuery, type PgDriver } from "./pg-shim";

/**
 * PgDriver over the VPS HTTPS SQL proxy (vps/db-proxy).
 *
 * Netlify Functions have no static egress IPs, so the VPS cannot allowlist them and a
 * Postgres port would have to accept the whole internet. The proxy keeps Postgres on a
 * private Docker network; this speaks to it over HTTPS with a bearer token.
 *
 * Shape-compatible with the pooled driver, so the ~300 existing `sql\`...\`` call sites are
 * untouched — the same reason the Supabase pg.Pool driver slotted in without call-site
 * changes.
 *
 * Connection reuse is the single biggest performance lever here: measured against the
 * deployed proxy, a fresh TLS handshake costs ~70ms out of a ~105ms request. Node's global
 * fetch (undici) pools keep-alive connections per process automatically, so warm
 * invocations pay the round trip only. Do not replace fetch with something that opens a
 * socket per call.
 */

/** Row shape is taken from PgDriver rather than redeclared, so the loose
 * `Record<string, any>` the ~300 existing call sites already assume stays defined in
 * exactly one place (see the note in pg-shim.ts on why it is not `unknown`). */
type DriverRows = Awaited<ReturnType<PgDriver["query"]>>;

interface ProxyResult {
  rows: DriverRows;
  rowCount: number;
  command: string;
}

function proxyConfig(): { url: string; token: string } {
  const url = process.env.DB_PROXY_URL;
  const token = process.env.DB_PROXY_TOKEN;
  if (!url || !token) throw new Error("VPS proxy not configured (DB_PROXY_URL / DB_PROXY_TOKEN missing)");
  return { url: url.replace(/\/$/, ""), token };
}

/** Every shape the proxy can return: results for queries, txId for /tx/begin, ok for
 * commit/rollback, error+code for failures. */
interface ProxyResponse {
  results?: ProxyResult[];
  txId?: string;
  ok?: boolean;
  error?: string;
  code?: string;
}

async function post(path: string, body: unknown): Promise<ProxyResponse> {
  const { url, token } = proxyConfig();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    // Next.js patches global fetch with its Data Cache. A cached query response would mean
    // serving stale rows — silently, and indistinguishably from a fast database. This was
    // caught by a latency probe reporting a 1ms round trip to Singapore, which is not
    // physically possible. Never remove this.
    cache: "no-store",
  });

  // The proxy returns JSON for every outcome including errors, but a Traefik-level failure
  // (502, cert problem) returns HTML — so don't assume the body parses.
  const text = await res.text();
  let parsed: ProxyResponse;
  try {
    parsed = JSON.parse(text) as ProxyResponse;
  } catch {
    throw new Error(`db-proxy ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    // Surface Postgres's own SQLSTATE where there is one; callers (and the replication
    // poller's error reporting) are more useful with it than without.
    const err = new Error(parsed.error ?? `db-proxy ${res.status}`) as Error & { code?: string };
    if (parsed.code) err.code = parsed.code;
    throw err;
  }
  return parsed;
}

/** Unwraps a query response, failing loudly rather than returning undefined rows if the
 * proxy ever answers 200 with an unexpected shape. */
function resultsOf(response: ProxyResponse): ProxyResult[] {
  if (!response.results) throw new Error("db-proxy returned no results array");
  return response.results;
}

/** Builds a driver whose statements all run through `send`. Used both for the top-level
 * driver (each call its own request) and inside a transaction (each call routed to an open
 * server-side session), so the two behave identically from a call site's perspective. */
function driverFrom(send: (statements: { sql: string; params: unknown[] }[]) => Promise<ProxyResult[]>): PgDriver {
  const driver = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, params } = buildTaggedQuery(strings, values);
    const [r] = await send([{ sql: text, params }]);
    return r.rows;
  }) as PgDriver;

  driver.query = async (text: string, params: unknown[] = []) => {
    const [r] = await send([{ sql: text, params }]);
    return r.rows;
  };

  driver.transaction = async <T>(fn: (tx: PgDriver) => Promise<T>): Promise<T> => {
    // PgDriver.transaction takes a callback that may branch on intermediate results, which
    // cannot be expressed as one batched request. So the proxy opens a real server-side
    // transaction holding a checked-out client, and each statement is routed to it by id.
    const { txId } = await post("/tx/begin", {});
    if (!txId) throw new Error("db-proxy did not return a txId");
    const tx = driverFrom(async (statements) => resultsOf(await post("/tx/query", { txId, statements })));
    try {
      const result = await fn(tx);
      await post("/tx/commit", { txId });
      return result;
    } catch (e) {
      // Best-effort: if the statement itself failed, the proxy has already rolled back and
      // discarded the session, so this 409s. Losing that error would mask the real one.
      await post("/tx/rollback", { txId }).catch(() => undefined);
      throw e;
    }
  };

  return driver;
}

let cached: PgDriver | null = null;

export function createHttpDriver(): PgDriver {
  if (!cached) {
    cached = driverFrom(async (statements) => resultsOf(await post("/query", { statements })));
  }
  return cached;
}

export function vpsConfigured(): boolean {
  return Boolean(process.env.DB_PROXY_URL && process.env.DB_PROXY_TOKEN);
}

/**
 * Runs several statements in ONE round trip, returning rows per statement.
 *
 * This is the capability the whole proxy design exists for, and it is not expressible
 * through PgDriver (which is one-query-at-a-time by construction, because that is the shape
 * the ~300 existing call sites use). Measured from a Netlify function, a single round trip
 * costs ~212ms while ten sequential ones cost ~2142ms — so any code path that issues
 * several *independent* queries should batch them here rather than awaiting each in turn.
 *
 * Only for independent statements: results come back together, so nothing in the list can
 * depend on an earlier one's rows. Use transaction() when it does.
 */
export async function queryBatch(
  statements: { sql: string; params?: unknown[] }[],
  opts: { transaction?: boolean } = {}
): Promise<DriverRows[]> {
  const normalised = statements.map((s) => ({ sql: s.sql, params: s.params ?? [] }));
  const response = await post("/query", { statements: normalised, transaction: opts.transaction === true });
  return resultsOf(response).map((r) => r.rows);
}
