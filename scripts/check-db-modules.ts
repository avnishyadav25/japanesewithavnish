import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const levels = await sql`SELECT id, code, name FROM curriculum_levels ORDER BY sort_order`;
  for (const lv of levels as { id: string; code: string; name: string }[]) {
    const mods = await sql`
      SELECT id, code, title FROM curriculum_modules
      WHERE level_id = ${lv.id} ORDER BY sort_order, code
    `;
    console.log(`\n[${lv.code}] ${mods.length} modules  (level_id: ${lv.id})`);
    for (const m of mods as { id: string; code: string; title: string }[]) {
      const subCount = await sql`SELECT COUNT(*) AS c FROM curriculum_submodules WHERE module_id = ${m.id}`;
      const lesCount = await sql`
        SELECT COUNT(*) AS c FROM curriculum_lessons l
        JOIN curriculum_submodules s ON s.id = l.submodule_id WHERE s.module_id = ${m.id}
      `;
      console.log(`  code=${m.code.padEnd(6)} lessons=${String((lesCount as {c:string}[])[0]?.c ?? 0).padStart(3)}  "${m.title}"  (id: ${m.id})`);
    }
  }
}
main().catch(console.error);
