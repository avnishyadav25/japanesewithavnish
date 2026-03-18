/**
 * Seed curriculum from parsed docs (N5 → N1). Ensures levels exist, then
 * inserts/updates curriculum_modules, curriculum_submodules, curriculum_lessons
 * with goal, introduction, and estimated_minutes (default 12).
 * Run: npx tsx scripts/seed-curriculum-from-docs.ts
 * Requires DATABASE_URL in .env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";
import {
  parseLevelDoc,
  type LevelParsed,
} from "./parse-curriculum-docs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const DOCS_DIR = path.join(process.cwd(), "docs");
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const DEFAULT_ESTIMATED_MINUTES = 12;

function loadParsedLevels(): LevelParsed[] {
  const out: LevelParsed[] = [];
  for (const level of LEVELS) {
    const file = path.join(DOCS_DIR, `curriculum-${level.toLowerCase()}-lessons.md`);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const modules = parseLevelDoc(content);
    if (modules.length === 0) continue;
    out.push({ levelCode: level, modules });
  }
  return out;
}

async function seed() {
  console.log("Seeding curriculum from docs (N5 → N1)...");

  // 1. Ensure levels exist
  const levelRows = (await sql`
    INSERT INTO curriculum_levels (code, name, sort_order)
    VALUES ('N5', 'JLPT N5', 10), ('N4', 'JLPT N4', 20), ('N3', 'JLPT N3', 30), ('N2', 'JLPT N2', 40), ('N1', 'JLPT N1', 50)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = NOW()
    RETURNING id, code
  `) as { id: string; code: string }[];
  const levelByCode: Record<string, string> = {};
  for (const r of levelRows) levelByCode[r.code] = r.id;
  console.log("Levels:", Object.keys(levelByCode));

  const parsed = loadParsedLevels();
  if (parsed.length === 0) {
    console.error("No curriculum docs found in docs/curriculum-n{5,4,3,2,1}-lessons.md");
    process.exit(1);
  }

  for (const level of parsed) {
    const levelId = levelByCode[level.levelCode];
    if (!levelId) {
      console.error("Level not found:", level.levelCode);
      continue;
    }
    let modSort = 0;
    for (const mod of level.modules) {
      const modRows = (await sql`
        INSERT INTO curriculum_modules (level_id, code, title, sort_order)
        VALUES (${levelId}, ${mod.code}, ${mod.title}, ${modSort})
        ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
        RETURNING id
      `) as { id: string }[];
      const moduleId = modRows[0]?.id;
      if (!moduleId) throw new Error(`Module ${mod.code} insert failed`);
      modSort += 10;

      let subSort = 0;
      for (const sub of mod.submodules) {
        const subRows = (await sql`
          INSERT INTO curriculum_submodules (module_id, code, title, sort_order)
          VALUES (${moduleId}, ${sub.code}, ${sub.title}, ${subSort})
          ON CONFLICT (module_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
          RETURNING id
        `) as { id: string }[];
        const submoduleId = subRows[0]?.id;
        if (!submoduleId) throw new Error(`Submodule ${sub.code} insert failed`);
        subSort += 10;

        let lessonSort = 0;
        for (const les of sub.lessons) {
          await sql`
            INSERT INTO curriculum_lessons (submodule_id, code, title, goal, introduction, sort_order, estimated_minutes)
            VALUES (${submoduleId}, ${les.code}, ${les.title}, ${les.goal}, ${les.introduction}, ${lessonSort}, ${DEFAULT_ESTIMATED_MINUTES})
            ON CONFLICT (submodule_id, code) DO UPDATE SET
              title = EXCLUDED.title, goal = EXCLUDED.goal, introduction = EXCLUDED.introduction,
              sort_order = EXCLUDED.sort_order, estimated_minutes = COALESCE(curriculum_lessons.estimated_minutes, EXCLUDED.estimated_minutes), updated_at = NOW()
          `;
          lessonSort += 10;
        }
      }
    }
    console.log(`Seeded ${level.levelCode}: ${level.modules.length} modules`);
  }

  console.log("Seed from docs done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
