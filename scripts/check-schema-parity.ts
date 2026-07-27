import "dotenv/config";
import { diffSchemas, fetchNeonSchema, fetchSupabaseSchema } from "../src/lib/db/schema-parity";

async function main() {
  console.log("Fetching schema from Neon...");
  const neonSchema = await fetchNeonSchema();

  console.log("Fetching schema from Supabase...");
  const supabaseSchema = await fetchSupabaseSchema();

  const diff = diffSchemas(neonSchema, supabaseSchema);

  console.log("\n=== Schema Parity Report ===");
  if (diff.missingInSupabase.length > 0) {
    console.log(`\nTables in Neon but missing in Supabase (${diff.missingInSupabase.length}):`);
    diff.missingInSupabase.forEach((t) => console.log(`  - ${t}`));
  }
  if (diff.missingInNeon.length > 0) {
    console.log(`\nTables in Supabase but missing in Neon (${diff.missingInNeon.length}):`);
    diff.missingInNeon.forEach((t) => console.log(`  - ${t}`));
  }
  if (diff.columnMismatches.length > 0) {
    console.log(`\nColumn mismatches on shared tables (${diff.columnMismatches.length}):`);
    diff.columnMismatches.forEach((m) => console.log(`  - [${m.table}] ${m.issue}`));
  }

  console.log(diff.ok ? "\nSchemas are in parity." : "\nSchema DRIFT detected.");
  if (!diff.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
