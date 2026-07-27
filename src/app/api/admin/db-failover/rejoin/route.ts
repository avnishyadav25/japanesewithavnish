import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getDriverFor } from "@/lib/db/drivers";
import { getFailoverStatus } from "@/lib/db/health";
import { runReplicationPollPass, TIGHT_REPLICATION_TABLES } from "@/lib/db/replication-poll";
import { resolveActiveProvider, type DbProvider } from "@/lib/db/resolve-provider";
import { diffSchemas, fetchNeonSchema, fetchSupabaseSchema } from "@/lib/db/schema-parity";

function isDbProvider(v: unknown): v is DbProvider {
  return v === "neon" || v === "supabase";
}

const LOOP_BUDGET_MS = 45_000;

/**
 * Manual, deliberate re-sync of a demoted/recovered provider back into standby role —
 * never automatic (see switch/route.ts's no-auto-rejoin design note). Call repeatedly
 * (same "Sync Now" pattern as the existing backup page) until the response reports
 * caughtUp: true. First call resets that provider's poll cursors to force a full
 * re-scan, since a provider that's been offline/orphaned can't be trusted to resume
 * from wherever it last stopped.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const provider = body.provider;
  const resetCursor = Boolean(body.resetCursor);
  if (!isDbProvider(provider)) return NextResponse.json({ error: "provider must be 'neon' or 'supabase'" }, { status: 400 });

  const active = await resolveActiveProvider();
  if (provider === active) {
    return NextResponse.json({ error: `${provider} is currently active — rejoin targets the standby, not the active provider` }, { status: 400 });
  }

  const status = await getFailoverStatus();
  if (!status.providers[provider].configured) {
    return NextResponse.json({ error: `${provider} is not configured` }, { status: 400 });
  }
  if (!status.providers[provider].reachable) {
    return NextResponse.json({ error: `${provider} is not reachable yet — cannot rejoin` }, { status: 409 });
  }

  try {
    const [neonSchema, supabaseSchema] = await Promise.all([fetchNeonSchema(), fetchSupabaseSchema()]);
    const diff = diffSchemas(neonSchema, supabaseSchema);
    if (!diff.ok) {
      return NextResponse.json({ error: "Schema drift detected — fix schema parity before rejoining.", diff }, { status: 409 });
    }
  } catch (e) {
    return NextResponse.json({ error: `Could not verify schema parity: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 409 });
  }

  if (resetCursor) {
    const driver = getDriverFor(provider);
    await driver.query(
      `UPDATE replication_poll_state SET last_cursor_value = NULL, last_row_id = NULL WHERE table_name = ANY($1)`,
      [TIGHT_REPLICATION_TABLES as unknown as string[]]
    );
  }

  const startedAt = Date.now();
  let totalRowsSynced = 0;
  let lastPass: Awaited<ReturnType<typeof runReplicationPollPass>> | null = null;
  do {
    lastPass = await runReplicationPollPass();
    totalRowsSynced += lastPass.results.reduce((sum, r) => sum + r.rowsSynced, 0);
  } while (lastPass.results.some((r) => r.rowsSynced > 0) && Date.now() - startedAt < LOOP_BUDGET_MS);

  const caughtUp = lastPass!.results.every((r) => r.ok && r.rowsSynced === 0);
  const anyErrors = lastPass!.results.some((r) => !r.ok);

  if (caughtUp && !anyErrors) {
    await Promise.allSettled(
      (["neon", "supabase"] as DbProvider[]).map(async (p) => {
        if (!status.providers[p].configured) return;
        await getDriverFor(p).query(
          `UPDATE db_failover_state SET standby_health = 'healthy', schema_parity_ok = TRUE, updated_at = NOW() WHERE id = 1`
        );
      })
    );
  }

  return NextResponse.json({ caughtUp: caughtUp && !anyErrors, totalRowsSynced, lastPass });
}
