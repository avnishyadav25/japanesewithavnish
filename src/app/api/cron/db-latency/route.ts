import { NextResponse } from "next/server";
import { getDriverFor } from "@/lib/db/drivers";
import { createHttpDriver, vpsConfigured } from "@/lib/db/http-driver";
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
  error?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function measure(provider: string, driver: PgDriver): Promise<Sample> {
  const base: Sample = { provider, reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null };
  try {
    const t0 = Date.now();
    await driver.query("SELECT 1");
    base.firstCallMs = Date.now() - t0;

    const warm: number[] = [];
    for (let i = 0; i < 12; i++) {
      const s = Date.now();
      await driver.query("SELECT 1");
      warm.push(Date.now() - s);
    }

    // Ten sequential queries is the shape that actually hurts: a page issuing N dependent
    // queries pays N round trips, so this is the number that predicts page latency.
    const seqStart = Date.now();
    for (let i = 0; i < 10; i++) await driver.query("SELECT 1");
    base.tenSequentialMs = Date.now() - seqStart;

    const sorted = [...warm].sort((a, b) => a - b);
    base.reachable = true;
    base.warmMs = warm;
    base.medianMs = percentile(sorted, 50);
    base.p95Ms = percentile(sorted, 95);
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

  const samples: Sample[] = [];

  // Current primary, whatever it is today.
  try {
    samples.push(await measure("neon (current primary)", getDriverFor("neon")));
  } catch (e) {
    samples.push({ provider: "neon", reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null, error: e instanceof Error ? e.message : "unknown" });
  }

  if (vpsConfigured()) {
    samples.push(await measure("vps (http proxy)", createHttpDriver()));
  } else {
    samples.push({ provider: "vps", reachable: false, firstCallMs: null, warmMs: [], medianMs: null, p95Ms: null, tenSequentialMs: null, error: "DB_PROXY_URL / DB_PROXY_TOKEN not set in this environment" });
  }

  const neon = samples[0];
  const vps = samples[1];
  const verdict =
    neon.medianMs && vps.medianMs
      ? {
          vpsVsPrimaryPct: Math.round(((vps.medianMs - neon.medianMs) / neon.medianMs) * 100),
          // The agreed cutover bar: within ~20% of the current primary, measured warm.
          withinAgreedBar: vps.medianMs <= neon.medianMs * 1.2,
        }
      : null;

  return NextResponse.json({
    measuredFrom: "netlify function (the only region that counts)",
    note: "firstCallMs includes TLS handshake; compare medianMs (warm) across providers, not firstCallMs.",
    samples,
    verdict,
  });
}
