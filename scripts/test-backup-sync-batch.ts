import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic import so dotenv's config() above runs before src/lib/db.ts reads
  // process.env.DATABASE_URL at module-init time (static imports get hoisted above
  // this file's own top-level code, which would otherwise read env vars too early).
  const { runBackupSyncBatch } = await import("../src/lib/db-backup");
  const result = await runBackupSyncBatch(true);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
