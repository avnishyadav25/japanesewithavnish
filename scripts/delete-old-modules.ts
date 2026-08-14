import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("🧹 Cleaning up old/extra modules...");

  // Find N5 level ID
  const levels = await sql`SELECT id FROM curriculum_levels WHERE code = 'N5' LIMIT 1`;
  if (!levels.length) {
    console.error("N5 level not found");
    return;
  }
  const n5LevelId = levels[0].id;

  // Let's delete modules in N5 where code is NOT in ('1', '2', '3', '4', '5', '6')
  const allowedCodes = ['1', '2', '3', '4', '5', '6'];
  const deleted = await sql`
    DELETE FROM curriculum_modules 
    WHERE level_id = ${n5LevelId} AND code NOT IN (${allowedCodes.join(',')})
    RETURNING id, code, title
  `;

  console.log(`Deleted ${deleted.length} old N5 modules:`);
  for (const m of deleted as { code: string; title: string }[]) {
    console.log(`  - Code: ${m.code}, Title: ${m.title}`);
  }

  console.log("Cleanup complete!");
}

main().catch(console.error);
