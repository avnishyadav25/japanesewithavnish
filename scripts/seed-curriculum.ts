/**
 * Seed curriculum_levels, curriculum_modules, curriculum_submodules, curriculum_lessons,
 * optional kana (hiragana a-row), and achievement_definitions.
 * Run: npx tsx scripts/seed-curriculum.ts
 * Requires DATABASE_URL in .env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function seed() {
  console.log("Seeding curriculum...");

  // 1. Levels
  const levelRows = await sql`
    INSERT INTO curriculum_levels (code, name, sort_order)
    VALUES ('N5', 'JLPT N5', 10), ('N4', 'JLPT N4', 20), ('N3', 'JLPT N3', 30), ('N2', 'JLPT N2', 40), ('N1', 'JLPT N1', 50)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = NOW()
    RETURNING id, code
  `;
  const levelByCode: Record<string, string> = {};
  for (const r of levelRows as { id: string; code: string }[]) {
    levelByCode[r.code] = r.id;
  }
  console.log("Levels:", Object.keys(levelByCode));

  const n5Id = levelByCode["N5"];
  if (!n5Id) throw new Error("N5 level not found");

  // 2. Modules for N5
  const modRows = await sql`
    INSERT INTO curriculum_modules (level_id, code, title, sort_order)
    VALUES (${n5Id}, 'M1', 'Hiragana & Basics', 10), (${n5Id}, 'M2', 'Greetings & Introductions', 20)
    ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
    RETURNING id, code
  `;
  const modByCode: Record<string, string> = {};
  for (const r of modRows as { id: string; code: string }[]) {
    modByCode[r.code] = r.id;
  }
  const m1Id = modByCode["M1"];
  const m2Id = modByCode["M2"];
  if (!m1Id || !m2Id) throw new Error("Modules not found");

  // 3. Submodules
  const subRows = await sql`
    INSERT INTO curriculum_submodules (module_id, code, title, sort_order)
    VALUES (${m1Id}, 'S1', 'Hiragana basics', 10), (${m2Id}, 'S1', 'Greetings', 10)
    ON CONFLICT (module_id, code) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order, updated_at = NOW()
    RETURNING id, code, module_id
  `;
  const subM1 = (subRows as { id: string; code: string; module_id: string }[]).find((s) => s.module_id === m1Id);
  const subM2 = (subRows as { id: string; code: string; module_id: string }[]).find((s) => s.module_id === m2Id);
  if (!subM1 || !subM2) throw new Error("Submodules not found");

  // 4. Lessons
  await sql`
    INSERT INTO curriculum_lessons (submodule_id, code, title, goal, introduction, sort_order)
    VALUES
      (${subM1.id}, 'L1', 'Hiragana あ-row', 'Read and write あ い う え お', 'Learn the first row of hiragana.', 10),
      (${subM1.id}, 'L2', 'Hiragana か-row', 'Read and write か き く け こ', 'Learn the か row with dakuten basics.', 20),
      (${subM2.id}, 'L1', 'Hello and goodbye', 'Use こんにちは and さようなら', 'Basic greetings for daily use.', 10),
      (${subM2.id}, 'L2', 'Self-introduction', 'Say your name with です', 'Introduce yourself in Japanese.', 20)
    ON CONFLICT (submodule_id, code) DO UPDATE SET
      title = EXCLUDED.title, goal = EXCLUDED.goal, introduction = EXCLUDED.introduction, sort_order = EXCLUDED.sort_order, updated_at = NOW()
  `;
  console.log("Lessons inserted/updated.");

  // 5. Kana (hiragana a-row only as starter)
  const aRow = [
    { char: "あ", romaji: "a", row: "a" },
    { char: "い", romaji: "i", row: "a" },
    { char: "う", romaji: "u", row: "a" },
    { char: "え", romaji: "e", row: "a" },
    { char: "お", romaji: "o", row: "a" },
  ];
  for (let i = 0; i < aRow.length; i++) {
    const { char, romaji, row } = aRow[i];
    await sql`
      INSERT INTO kana (character, type, romaji, row_label, sort_order)
      VALUES (${char}, 'hiragana', ${romaji}, ${row}, ${i})
      ON CONFLICT (character, type) DO UPDATE SET romaji = EXCLUDED.romaji, row_label = EXCLUDED.row_label, sort_order = EXCLUDED.sort_order
    `;
  }
  console.log("Kana (a-row) inserted/updated.");

  // 6. Achievement definitions
  const achievements = [
    { code: "first_login", name: "First steps", description: "Signed in for the first time", points: 10 },
    { code: "first_lesson", name: "First lesson", description: "Completed your first lesson", points: 20 },
    { code: "streak_3", name: "3-day streak", description: "Studied 3 days in a row", points: 15 },
    { code: "streak_7", name: "Week warrior", description: "7-day streak", points: 50 },
    { code: "level_n5", name: "N5 complete", description: "Completed N5 curriculum", points: 100 },
  ];
  for (const a of achievements) {
    await sql`
      INSERT INTO achievement_definitions (code, name, description, points)
      VALUES (${a.code}, ${a.name}, ${a.description}, ${a.points})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, points = EXCLUDED.points
    `;
  }
  console.log("Achievement definitions inserted/updated.");

  console.log("Seed done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
