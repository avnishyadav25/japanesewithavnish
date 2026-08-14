import "dotenv/config";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getDriverFor } from "../src/lib/db/drivers";
import type { PgDriver } from "../src/lib/db/pg-shim";
import type { DbProvider } from "../src/lib/db/resolve-provider";

/**
 * Applies pending SQL migrations and records them in schema_migrations.
 *
 *   npm run db:migrate -- --status     # what is pending, per provider
 *   npm run db:migrate -- --baseline   # mark everything as applied WITHOUT running it
 *   npm run db:migrate                 # apply pending migrations to both providers
 *   npm run db:migrate -- --target=primary
 *
 * Applies to BOTH providers by default. That is the whole point: the standby drifted 44
 * tables behind because migrations were pasted into one SQL editor by hand, and nothing
 * recorded or enforced that the other side had run them too.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

type Target = "primary" | "standby" | "both";

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    // Sort by numeric prefix, then filename, so ordering never depends on locale or
    // readdir order. Files sharing a prefix (there are four such pairs from before the
    // ledger existed) resolve deterministically by name.
    .sort((a, b) => {
      const na = Number(a.slice(0, 3));
      const nb = Number(b.slice(0, 3));
      return na === nb ? a.localeCompare(b) : na - nb;
    });
}

function checksum(file: string): string {
  return createHash("sha256").update(readFileSync(join(MIGRATIONS_DIR, file))).digest("hex").slice(0, 16);
}

/** Refuses to let a NEW migration reuse an existing numeric prefix. The four historical
 * collisions predate this ledger and are grandfathered via `applied`. */
function assertNoNewPrefixCollisions(files: string[], applied: Set<string>): void {
  const byPrefix = new Map<string, string[]>();
  for (const f of files) {
    const p = f.slice(0, 3);
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p)!.push(f);
  }
  const offenders: string[] = [];
  for (const [prefix, group] of byPrefix) {
    if (group.length < 2) continue;
    if (group.some((f) => !applied.has(f))) offenders.push(`${prefix}: ${group.join(", ")}`);
  }
  if (offenders.length > 0) {
    console.error("Refusing to run — unapplied migrations share a numeric prefix, so apply order is ambiguous:");
    offenders.forEach((o) => console.error(`  ${o}`));
    console.error("Renumber the new file to a unique prefix.");
    process.exit(1);
  }
}

async function ensureLedger(driver: PgDriver): Promise<void> {
  await driver.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum   TEXT
    )
  `);
}

async function appliedSet(driver: PgDriver): Promise<Map<string, string | null>> {
  await ensureLedger(driver);
  const rows = await driver.query(`SELECT filename, checksum FROM schema_migrations`);
  return new Map(rows.map((r) => [r.filename as string, (r.checksum as string) ?? null]));
}

async function runFor(provider: DbProvider, files: string[], baseline: boolean): Promise<void> {
  const driver = getDriverFor(provider);
  const applied = await appliedSet(driver);

  // A migration edited after it was applied means the two providers may have run different
  // text. Report it rather than silently re-running (which is rarely idempotent).
  for (const f of files) {
    const known = applied.get(f);
    if (known !== undefined && known !== null && known !== checksum(f)) {
      console.warn(`  [${provider}] WARNING ${f} changed since it was applied (${known} -> ${checksum(f)})`);
    }
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log(`  [${provider}] up to date (${applied.size} applied)`);
    return;
  }

  if (baseline) {
    for (const f of pending) {
      await driver.query(`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING`, [f, checksum(f)]);
    }
    console.log(`  [${provider}] baselined ${pending.length} migration(s) as already applied`);
    return;
  }

  console.log(`  [${provider}] applying ${pending.length} migration(s)`);
  for (const f of pending) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    // Each migration runs in its own transaction: a failure leaves that migration fully
    // rolled back and unrecorded, so a re-run retries exactly it rather than half of it.
    await driver.transaction(async (tx) => {
      await tx.query(sqlText);
      await tx.query(`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`, [f, checksum(f)]);
    });
    console.log(`    ✓ ${f}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const baseline = args.includes("--baseline");
  const statusOnly = args.includes("--status");
  const targetArg = (args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "both") as Target;

  const files = migrationFiles();
  const providers: DbProvider[] = targetArg === "both" ? ["neon", "supabase"] : targetArg === "primary" ? ["neon"] : ["supabase"];

  console.log(`${files.length} migration file(s) on disk; target=${targetArg}${baseline ? " (baseline)" : ""}`);

  if (statusOnly) {
    for (const p of providers) {
      const applied = await appliedSet(getDriverFor(p));
      const pending = files.filter((f) => !applied.has(f));
      console.log(`  [${p}] applied=${applied.size} pending=${pending.length}`);
      pending.slice(0, 20).forEach((f) => console.log(`      pending: ${f}`));
    }
    return;
  }

  if (!baseline) {
    const applied = await appliedSet(getDriverFor(providers[0]));
    assertNoNewPrefixCollisions(files, new Set(applied.keys()));
  }

  for (const p of providers) await runFor(p, files, baseline);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
