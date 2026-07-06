/**
 * Phase 4: Full Curriculum Seed
 * Seeds all 5 levels (N5–N1), 30 modules, submodules, lessons, and practices
 * in a single idempotent run.
 *
 * Run:
 *   npx tsx scripts/seed-full-curriculum.ts
 *   npx tsx scripts/seed-full-curriculum.ts --level N5
 *   npx tsx scripts/seed-full-curriculum.ts --dry-run
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { n5Modules } from "./curriculum-data/n5";
import { n4Modules } from "./curriculum-data/n4";
import { n3Modules } from "./curriculum-data/n3";
import { n2Modules } from "./curriculum-data/n2";
import { n1Modules } from "./curriculum-data/n1";
import type { ModuleEntry } from "./curriculum-data/types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL required in .env");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const argv = process.argv.slice(2);
const isDryRun = argv.includes("--dry-run");
const levelArgIdx = argv.indexOf("--level");
const levelFilter = argv.find((a) => a.startsWith("--level="))?.split("=")[1]
  ?? (levelArgIdx !== -1 && argv[levelArgIdx + 1] && !argv[levelArgIdx + 1].startsWith("--")
    ? argv[levelArgIdx + 1]
    : undefined);

const LEVELS: { code: string; name: string; sort_order: number; modules: ModuleEntry[] }[] = [
  { code: "N5", name: "JLPT N5", sort_order: 10, modules: n5Modules },
  { code: "N4", name: "JLPT N4", sort_order: 20, modules: n4Modules },
  { code: "N3", name: "JLPT N3", sort_order: 30, modules: n3Modules },
  { code: "N2", name: "JLPT N2", sort_order: 40, modules: n2Modules },
  { code: "N1", name: "JLPT N1", sort_order: 50, modules: n1Modules },
];

const stats = {
  levels: 0, modules: 0, submodules: 0, lessons: 0, practices: 0,
};

async function seedLevel(levelCode: string, levelName: string, levelSort: number, modules: ModuleEntry[]) {
  console.log(`\n🌐 Level ${levelCode}`);

  // Upsert level
  if (!isDryRun) {
    const [lv] = (await sql`
      INSERT INTO curriculum_levels (code, name, sort_order)
      VALUES (${levelCode}, ${levelName}, ${levelSort})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = NOW()
      RETURNING id
    `) as { id: string }[];
    stats.levels++;

    const levelId = lv.id;

    let modSort = 10;
    for (const mod of modules) {
      process.stdout.write(`  📦 Module ${mod.code}: ${mod.title} ... `);
      const [modRow] = (await sql`
        INSERT INTO curriculum_modules (level_id, code, title, sort_order)
        VALUES (${levelId}, ${mod.code}, ${mod.title}, ${modSort})
        ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
        RETURNING id
      `) as { id: string }[];
      stats.modules++;
      modSort += 10;

      const moduleId = modRow.id;
      let subSort = 10;
      for (const sub of mod.submodules) {
        const [subRow] = (await sql`
          INSERT INTO curriculum_submodules (module_id, code, title, sort_order)
          VALUES (${moduleId}, ${sub.code}, ${sub.title}, ${subSort})
          ON CONFLICT (module_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
          RETURNING id
        `) as { id: string }[];
        stats.submodules++;
        subSort += 10;

        const submoduleId = subRow.id;
        let lesSort = 10;
        for (const les of sub.lessons) {
          const [lesRow] = (await sql`
            INSERT INTO curriculum_lessons
              (submodule_id, code, title, description, access_type, content_type, estimated_minutes, sort_order)
            VALUES (
              ${submoduleId}, ${les.code}, ${les.title},
              ${les.description ?? null},
              ${les.access_type},
              ${les.content_type},
              ${les.estimated_minutes ?? null},
              ${lesSort}
            )
            ON CONFLICT (submodule_id, code) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              access_type = EXCLUDED.access_type,
              content_type = EXCLUDED.content_type,
              estimated_minutes = EXCLUDED.estimated_minutes,
              sort_order = EXCLUDED.sort_order,
              updated_at = NOW()
            RETURNING id
          `) as { id: string }[];
          stats.lessons++;
          lesSort += 10;

          const lessonId = lesRow.id;
          // Practices: delete existing and re-insert to ensure clean state
          await sql`DELETE FROM curriculum_practices WHERE lesson_id = ${lessonId}`;

          let pracSort = 10;
          for (const prac of les.practices) {
            await sql`
              INSERT INTO curriculum_practices
                (lesson_id, title, description, practice_type, sort_order, estimated_minutes)
              VALUES (
                ${lessonId}, ${prac.title},
                ${prac.description ?? null},
                ${prac.practice_type},
                ${pracSort},
                ${prac.estimated_minutes ?? null}
              )
            `;
            stats.practices++;
            pracSort += 10;
          }
        }
      }
      console.log(`✓ (${mod.submodules.length} submodules, ${mod.submodules.flatMap((s) => s.lessons).length} lessons)`);
    }
  } else {
    // Dry run: just count
    for (const mod of modules) {
      console.log(`  [DRY] Module ${mod.code}: ${mod.title}`);
      for (const sub of mod.submodules) {
        for (const les of sub.lessons) {
          stats.lessons++;
          stats.practices += les.practices.length;
        }
        stats.submodules++;
      }
      stats.modules++;
    }
    stats.levels++;
  }
}

async function main() {
  console.log(`\n🌸 Full Curriculum Seed${isDryRun ? " (DRY RUN)" : ""}${levelFilter ? ` — Level ${levelFilter}` : ""}\n`);

  const toSeed = levelFilter
    ? LEVELS.filter((l) => l.code.toUpperCase() === levelFilter.toUpperCase())
    : LEVELS;

  if (toSeed.length === 0) {
    console.error(`❌ No matching level found for: ${levelFilter}`);
    process.exit(1);
  }

  for (const { code, name, sort_order, modules } of toSeed) {
    await seedLevel(code, name, sort_order, modules);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Seed Summary:");
  console.log(`   Levels:     ${stats.levels}`);
  console.log(`   Modules:    ${stats.modules}`);
  console.log(`   Submodules: ${stats.submodules}`);
  console.log(`   Lessons:    ${stats.lessons}`);
  console.log(`   Practices:  ${stats.practices}`);
  if (isDryRun) console.log("\n⚠️  DRY RUN — no database changes made.");
  else console.log("\n✅ Seed complete!");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
