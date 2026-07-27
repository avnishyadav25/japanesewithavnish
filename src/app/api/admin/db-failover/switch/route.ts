import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getDriverFor, otherProvider } from "@/lib/db/drivers";
import { getFailoverStatus } from "@/lib/db/health";
import { runReplicationPollPass } from "@/lib/db/replication-poll";
import { resolveActiveProvider, setActiveProviderInTurso, type DbProvider } from "@/lib/db/resolve-provider";
import { diffSchemas, fetchNeonSchema, fetchSupabaseSchema } from "@/lib/db/schema-parity";

function isDbProvider(v: unknown): v is DbProvider {
  return v === "neon" || v === "supabase";
}

/**
 * Admin-triggered cutover. No auto-rejoin: the demoted provider requires a manual
 * POST /rejoin before it's trusted as standby again (src/app/api/admin/db-failover/rejoin).
 * Because the polling sync (src/lib/db/replication-poll.ts) always reads direction from
 * resolveActiveProvider() on every pass, flipping the flag here is enough to reverse sync
 * direction too — no separate replication teardown/setup step needed.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = body.target;
  const force = Boolean(body.force);
  if (!isDbProvider(target)) return NextResponse.json({ error: "target must be 'neon' or 'supabase'" }, { status: 400 });

  const current = await resolveActiveProvider();
  if (target === current) return NextResponse.json({ error: `${target} is already active` }, { status: 400 });

  const status = await getFailoverStatus();
  if (!status.providers[target].configured) {
    return NextResponse.json({ error: `${target} is not configured` }, { status: 400 });
  }
  if (!status.providers[target].reachable && !force) {
    return NextResponse.json(
      { error: `${target} is not reachable. Pass force:true to switch anyway (accepted data-loss risk).` },
      { status: 409 }
    );
  }

  if (!force) {
    try {
      const [neonSchema, supabaseSchema] = await Promise.all([fetchNeonSchema(), fetchSupabaseSchema()]);
      const diff = diffSchemas(neonSchema, supabaseSchema);
      if (!diff.ok) {
        return NextResponse.json(
          { error: "Schema drift detected between Neon and Supabase — refusing to switch. Pass force:true to override.", diff },
          { status: 409 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Could not verify schema parity before switching: ${e instanceof Error ? e.message : "unknown error"}. Pass force:true to override.` },
        { status: 409 }
      );
    }
  }

  // Best-effort final drain in the *current* direction before flipping — minimizes the
  // write gap. Runs while `current` is still what resolveActiveProvider() returns.
  let measuredLagSeconds: number | null = null;
  try {
    await runReplicationPollPass();
  } catch {
    // best-effort only — a failed drain doesn't block the switch, it's exactly the
    // scenario `force` exists for when the source truly can't be reached.
  }
  if (status.replicationLag) {
    const known = status.replicationLag.filter((r) => r.lagSeconds !== null).map((r) => r.lagSeconds as number);
    if (known.length > 0) measuredLagSeconds = Math.max(...known);
  }

  await setActiveProviderInTurso(target);

  // Best-effort audit log + state update on both sides — the demoted side may be
  // unreachable (that's exactly why force exists), so failures here don't undo the switch.
  await Promise.allSettled(
    (["neon", "supabase"] as DbProvider[]).map(async (p) => {
      if (!status.providers[p].configured) return;
      const driver = getDriverFor(p);
      await driver.query(
        `INSERT INTO db_failover_log (from_provider, to_provider, triggered_by, measured_lag_seconds, forced, outcome)
         VALUES ($1, $2, $3, $4, $5, 'ok')`,
        [current, target, admin.email, measuredLagSeconds, force]
      );
      await driver.query(
        `UPDATE db_failover_state
         SET active_provider = $1, standby_provider = $2, last_switch_at = NOW(), last_switch_by = $3,
             standby_health = 'unknown', updated_at = NOW()
         WHERE id = 1`,
        [target, otherProvider(target), admin.email]
      );
    })
  );

  return NextResponse.json({ ok: true, from: current, to: target, measuredLagSeconds });
}
