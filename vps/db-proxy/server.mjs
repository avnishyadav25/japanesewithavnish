import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import pg from "pg";

/**
 * HTTPS-fronted SQL proxy for the app's Postgres.
 *
 * Netlify Functions have no static egress IPs, so a Postgres port would have to accept
 * connections from the entire internet to be usable. Instead Postgres stays on a private
 * Docker network, and this service is the only thing Traefik routes to — authenticated,
 * TLS-terminated, and speaking a request/response shape the app's existing PgDriver
 * abstraction (src/lib/db/pg-shim.ts) already fits.
 *
 * It also lets several statements share one round trip, which matters when the caller is
 * ~230ms away.
 *
 * Deliberately dependency-light: node:http plus pg. Every dependency here is a package
 * that gets to run code on the machine holding the production database.
 */

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.DB_PROXY_TOKEN;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 8 * 1024 * 1024);
const TX_IDLE_TIMEOUT_MS = Number(process.env.TX_IDLE_TIMEOUT_MS ?? 30_000);
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 1200);

// Fail closed. A proxy that starts without a token would happily serve the whole database
// to anyone who found the hostname.
if (!TOKEN || TOKEN.length < 32) {
  console.error("DB_PROXY_TOKEN must be set and at least 32 characters. Refusing to start.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => console.error("pg pool error:", err.message));

/** Constant-time compare so a wrong token can't be recovered by timing the response. */
function tokenValid(header) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(TOKEN);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

// Open transactions, each holding a checked-out client. The app's PgDriver exposes
// transaction(fn) with a callback that can branch on intermediate results, which cannot be
// expressed as a single batched request — so a transaction is a short-lived server-side
// session instead. Reaped on idle so a client that dies mid-transaction cannot leak a
// connection out of the pool permanently.
const transactions = new Map();

function reapIdleTransactions() {
  const now = Date.now();
  for (const [id, tx] of transactions) {
    if (now - tx.touchedAt < TX_IDLE_TIMEOUT_MS) continue;
    transactions.delete(id);
    tx.client.query("ROLLBACK").catch(() => {}).finally(() => tx.client.release());
    console.warn(`transaction ${id} rolled back after ${TX_IDLE_TIMEOUT_MS}ms idle`);
  }
}
setInterval(reapIdleTransactions, 5_000).unref();

// Coarse fixed-window rate limit. Not a substitute for the token — it exists so a leaked
// token cannot be used to hammer the database unboundedly before anyone notices.
let windowStart = Date.now();
let windowCount = 0;
function rateLimited() {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  return ++windowCount > RATE_LIMIT_PER_MIN;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("body is not valid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/** Runs a list of {sql, params} against a client, returning rows per statement. */
async function runStatements(client, statements) {
  if (!Array.isArray(statements) || statements.length === 0) {
    throw Object.assign(new Error("statements must be a non-empty array"), { status: 400 });
  }
  const results = [];
  for (const s of statements) {
    if (!s || typeof s.sql !== "string") {
      throw Object.assign(new Error("each statement needs a sql string"), { status: 400 });
    }
    const r = await client.query(s.sql, s.params ?? []);
    results.push({ rows: r.rows, rowCount: r.rowCount, command: r.command });
  }
  return results;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    // Unauthenticated liveness probe. Deliberately reveals nothing beyond reachability.
    if (req.method === "GET" && url.pathname === "/health") {
      try {
        await pool.query("SELECT 1");
        return send(res, 200, { ok: true });
      } catch {
        return send(res, 503, { ok: false });
      }
    }

    if (!tokenValid(req.headers.authorization)) return send(res, 401, { error: "unauthorized" });
    if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
    if (rateLimited()) return send(res, 429, { error: "rate limited" });

    const body = await readBody(req);

    // One-shot batch. `transaction: true` wraps the whole batch in BEGIN/COMMIT, which
    // covers the common case in a single round trip.
    if (url.pathname === "/query") {
      const client = await pool.connect();
      try {
        const wrap = body.transaction === true;
        if (wrap) await client.query("BEGIN");
        try {
          const results = await runStatements(client, body.statements);
          if (wrap) await client.query("COMMIT");
          return send(res, 200, { results });
        } catch (e) {
          if (wrap) await client.query("ROLLBACK").catch(() => {});
          throw e;
        }
      } finally {
        client.release();
      }
    }

    // Multi-round-trip transaction, for callers that must branch on intermediate results.
    if (url.pathname === "/tx/begin") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
      } catch (e) {
        client.release();
        throw e;
      }
      const id = randomUUID();
      transactions.set(id, { client, touchedAt: Date.now() });
      return send(res, 200, { txId: id });
    }

    if (url.pathname === "/tx/query" || url.pathname === "/tx/commit" || url.pathname === "/tx/rollback") {
      const tx = transactions.get(body.txId);
      if (!tx) return send(res, 409, { error: "unknown or expired txId" });
      tx.touchedAt = Date.now();

      if (url.pathname === "/tx/query") {
        try {
          const results = await runStatements(tx.client, body.statements);
          return send(res, 200, { results });
        } catch (e) {
          // Postgres has already aborted the transaction; drop it so the client cannot keep
          // issuing statements against a dead session and get confusing errors.
          transactions.delete(body.txId);
          await tx.client.query("ROLLBACK").catch(() => {});
          tx.client.release();
          throw e;
        }
      }

      transactions.delete(body.txId);
      try {
        await tx.client.query(url.pathname === "/tx/commit" ? "COMMIT" : "ROLLBACK");
        return send(res, 200, { ok: true });
      } finally {
        tx.client.release();
      }
    }

    return send(res, 404, { error: "not found" });
  } catch (e) {
    const status = e?.status ?? 500;
    if (status >= 500) console.error("proxy error:", e?.message);
    // Postgres error codes are useful to the caller and not sensitive; the stack is neither.
    return send(res, status, { error: e?.message ?? "internal error", code: e?.code });
  }
});

server.headersTimeout = 65_000;
server.requestTimeout = 120_000;

server.listen(PORT, () => console.log(`db-proxy listening on ${PORT}`));

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
