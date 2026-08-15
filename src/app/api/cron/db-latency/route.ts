import { NextResponse } from "next/server";
import { getDriverFor } from "@/lib/db/drivers";
import { createHttpDriver, queryBatch, vpsConfigured } from "@/lib/db/http-driver";
import type { PgDriver } from "@/lib/db/pg-shim";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Measures query latency from *inside a deployed function*, which is the only measurement
 * that can decide the VPS cutover.
 *
 * Measuring from a developer machine is actively misleading: from India the Mumbai VPS is
 * ~30ms and Singapore Neon ~80ms, while Netlify's functions run from the US where that
 * ordering roughly reverses. Numbers taken anywhere else do not transfer.
 *
 * Reports each provider's warm per-query cost separately from the first call, because the
 * first call pays a TLS handshake (~70ms against the proxy) that warm invocations do not.
 * Comparing a cold number against a warm one is how the original 262ms-vs-81ms confusion
 * happened.
 *
 * GET /api/cron/db-latency?key=CRON_SECRET
 */

interface Sample {
  provider: string;
  reachable: boolean;
  firstCallMs: number | null;
  warmMs: number[];
  medianMs: number | null;
  p95Ms: number | null;
  tenSequentialMs: number | null;
  /** Round trip for a server-side pg_sleep(0.25). A real network call cannot beat 250ms. */
  sanityMs: number | null;
  /** False means the numbers above are not measuring the database. Do not act on them. */
  trustworthy: boolean;
  error?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/** Every query must be textually unique.
 *
 * The first version of this route measured `SELECT 1` in a loop and reported a 1ms median
 * from a US region to Singapore — physically impossible, since light alone needs ~200ms
 * round trip. Both drivers go through fetch, and Next.js patches fetch: identical repeated
 * requests were being served from its cache rather than the network. The route was
 * measuring the cache. A unique literal per call defeats any dedupe keyed on request
 * identity. */
function uniqueSelect(tag: string, i: number): string {
  return `SELECT ${i} AS n, '${tag}-${i}' AS tag`;
}

async function measure(provider: string, driver: PgDriver, runId: string): Promise<Sample> {
  const base: Sample = { provider, reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null, sanityMs: null, trustworthy: false };
  try {
    const t0 = Date.now();
    await driver.query(uniqueSelect(`${runId}-first`, 0));
    base.firstCallMs = Date.now() - t0;

    const warm: number[] = [];
    for (let i = 0; i < 12; i++) {
      const s = Date.now();
      await driver.query(uniqueSelect(`${runId}-warm`, i));
      warm.push(Date.now() - s);
    }

    // Ten sequential queries is the shape that actually hurts: a page issuing N dependent
    // queries pays N round trips, so this predicts page latency far better than one SELECT.
    const seqStart = Date.now();
    for (let i = 0; i < 10; i++) await driver.query(uniqueSelect(`${runId}-seq`, i));
    base.tenSequentialMs = Date.now() - seqStart;

    // Self-check: ask the server to sleep 250ms. A real round trip cannot come back faster
    // than that. If it does, the numbers above are measuring something other than the
    // database and must not be used to justify a cutover.
    const sanityStart = Date.now();
    await driver.query(`SELECT pg_sleep(0.25), '${runId}-sanity' AS tag`);
    base.sanityMs = Date.now() - sanityStart;

    const sorted = [...warm].sort((a, b) => a - b);
    base.reachable = true;
    base.warmMs = warm;
    base.medianMs = percentile(sorted, 50);
    base.p95Ms = percentile(sorted, 95);
    base.trustworthy = base.sanityMs >= 240;
    return base;
  } catch (e) {
    base.error = e instanceof Error ? e.message : "unknown error";
    return base;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || (key !== CRON_SECRET && !bearerMatches)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const samples: Sample[] = [];

  // Current primary, whatever it is today.
  try {
    samples.push(await measure("neon (current primary)", getDriverFor("neon"), runId));
  } catch (e) {
    samples.push({ provider: "neon", reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null, sanityMs: null, trustworthy: false, error: e instanceof Error ? e.message : "unknown" });
  }

  if (vpsConfigured()) {
    samples.push(await measure("vps (http proxy)", createHttpDriver(), runId));
  } else {
    samples.push({ provider: "vps", reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null, sanityMs: null, trustworthy: false, error: "DB_PROXY_URL / DB_PROXY_TOKEN not set in this environment" });
  }

  // The architectural question, separate from which host is faster: ten INDEPENDENT queries
  // in one round trip versus ten sequential ones. Only the proxy can do this; Neon's driver
  // has no equivalent, which is why there is no per-provider comparison here.
  let batchedTenMs: number | null = null;
  if (vpsConfigured()) {
    try {
      const stmts = Array.from({ length: 10 }, (_, i) => ({ sql: `SELECT ${i} AS n, '${runId}-batch-${i}' AS tag` }));
      const t = Date.now();
      await queryBatch(stmts);
      batchedTenMs = Date.now() - t;
    } catch {
      batchedTenMs = null;
    }
  }

  const neon = samples[0];
  const vps = samples[1];
  const bothTrustworthy = neon.trustworthy && vps.trustworthy;
  const verdict =
    bothTrustworthy && neon.medianMs && vps.medianMs
      ? {
          vpsVsPrimaryPct: Math.round(((vps.medianMs - neon.medianMs) / neon.medianMs) * 100),
          // The agreed cutover bar: within ~20% of the current primary, measured warm.
          withinAgreedBar: vps.medianMs <= neon.medianMs * 1.2,
        }
      : null;

  return NextResponse.json({
    measuredFrom: "netlify function (the only region that counts)",
    note: "firstCallMs includes TLS handshake; compare medianMs (warm) across providers, not firstCallMs.",
    trustworthy: bothTrustworthy,
    warning: bothTrustworthy
      ? undefined
      : "sanityMs shows a pg_sleep(0.25) returning faster than 250ms, so these timings are not measuring the database. Do not use them to justify a cutover.",
    samples,
    verdict,
    batching: {
      vpsTenBatchedMs: batchedTenMs,
      vpsTenSequentialMs: vps.tenSequentialMs,
      // How much of a multi-query page's latency is round trips rather than database work.
      speedupVsSequential:
        batchedTenMs && vps.tenSequentialMs ? Number((vps.tenSequentialMs / batchedTenMs).toFixed(1)) : null,
      note: "Ten independent queries in one round trip vs ten sequential. Batching is worth far more than the choice of host.",
    },
  });
}
