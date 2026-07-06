import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function run() {
  console.log("Adding slug column to curriculum_lessons...");
  await sql`ALTER TABLE curriculum_lessons ADD COLUMN IF NOT EXISTS slug TEXT`;

  console.log("Fetching all lessons...");
  const lessons = await sql`
    SELECT l.id, l.title, lv.code AS level_code
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
  ` as { id: string; title: string; level_code: string }[];

  console.log(`Found ${lessons.length} lessons. Setting slugs...`);
  for (const l of lessons) {
    const slugBase = slugify(`${l.level_code}-${l.title}`);
    let slug = slugBase;
    let attempt = 0;
    while (true) {
      try {
        // Find if this slug is already used
        const dup = await sql`SELECT id FROM curriculum_lessons WHERE slug = ${slug} AND id != ${l.id} LIMIT 1`;
        if (dup.length > 0) {
          attempt++;
          slug = `${slugBase}-${attempt}`;
        } else {
          await sql`UPDATE curriculum_lessons SET slug = ${slug} WHERE id = ${l.id}`;
          break;
        }
      } catch (e: any) {
        console.error("Error setting slug for lesson:", l.title, e);
        throw e;
      }
    }
  }

  // Add UNIQUE constraint if not exists
  try {
    await sql`ALTER TABLE curriculum_lessons ADD CONSTRAINT curriculum_lessons_slug_unique UNIQUE (slug)`;
  } catch (e) {
    console.log("Unique constraint already exists or failed to add:", e);
  }
  console.log("Successfully migrated and populated slugs!");
}

run().catch(console.error);
