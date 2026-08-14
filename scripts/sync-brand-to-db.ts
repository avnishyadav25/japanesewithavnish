/**
 * Pushes the confirmed social accounts in src/lib/brand.ts into the database.
 *
 *   npx tsx scripts/sync-brand-to-db.ts            PILOT — prints the diff, writes nothing
 *   npx tsx scripts/sync-brand-to-db.ts --apply    writes site_settings + social_channels
 *
 * `brand.ts` is the source of truth for the accounts; `site_settings` is what the website reads
 * and what an admin can edit at /admin/settings. They drifted badly once already — the footer
 * and the structured data were pointing at `learnjapanesewithavnish` while the real Instagram is
 * `japanesewithavnish` — so this exists to put them back in step deliberately rather than by
 * someone remembering to.
 *
 * Only rows that differ are touched, and the pilot shows exactly what would change.
 */
import { config as loadEnv } from "dotenv";
import { SOCIALS } from "../src/lib/brand";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const apply = process.argv.includes("--apply");
  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const db = sql;

  // Unconfirmed accounts are skipped entirely: writing a guessed profile URL into settings
  // creates a dead link that someone will surface later believing it was verified.
  const accounts = SOCIALS.filter((s) => s.confirmed);
  const skipped = SOCIALS.filter((s) => !s.confirmed);
  console.log(`${apply ? "APPLY" : "PILOT"} — syncing ${accounts.length} confirmed accounts`);
  if (skipped.length > 0) console.log(`skipping unconfirmed: ${skipped.map((s) => s.platform).join(", ")}\n`);

  const existing = (await db`
    SELECT key, value FROM site_settings WHERE key = ANY(${accounts.map((s) => s.settingsKey)})
  `) as { key: string; value: unknown }[];
  const current = new Map(existing.map((r) => [r.key, typeof r.value === "string" ? r.value : ""]));

  let changed = 0;
  for (const account of accounts) {
    const was = current.get(account.settingsKey) ?? "";
    const now = account.url;
    if (was === now) {
      console.log(`  =  ${account.settingsKey.padEnd(16)} ${now}`);
      continue;
    }
    changed += 1;
    console.log(`  ${was ? "~" : "+"}  ${account.settingsKey.padEnd(16)} ${was || "(unset)"}`);
    console.log(`     ${" ".repeat(16)} -> ${now}`);

    if (apply) {
      // site_settings stores value as JSONB in some rows and text in others depending on how it
      // was seeded; to_jsonb keeps a plain string consistent either way.
      await db`
        INSERT INTO site_settings (key, value) VALUES (${account.settingsKey}, to_jsonb(${now}::text))
        ON CONFLICT (key) DO UPDATE SET value = to_jsonb(${now}::text)
      `;
    }
  }

  // The social engine's channel rows carry the handle shown in the admin UI. Keep them honest
  // too, so /admin/social does not display a handle the site no longer uses.
  console.log("\nsocial_channels handles:");
  for (const account of accounts) {
    const rows = (await db`SELECT handle FROM social_channels WHERE platform = ${account.platform}`) as { handle: string | null }[];
    if (rows.length === 0) continue;
    const was = rows[0].handle ?? "";
    if (was === account.handle) {
      console.log(`  =  ${account.platform.padEnd(10)} ${account.handle}`);
      continue;
    }
    changed += 1;
    console.log(`  ~  ${account.platform.padEnd(10)} ${was || "(unset)"} -> ${account.handle}`);
    if (apply) {
      await db`UPDATE social_channels SET handle = ${account.handle}, updated_at = NOW() WHERE platform = ${account.platform}`;
    }
  }

  console.log(
    apply
      ? `\n${changed} row${changed === 1 ? "" : "s"} updated.`
      : `\n${changed} row${changed === 1 ? "" : "s"} would change. Re-run with --apply.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
