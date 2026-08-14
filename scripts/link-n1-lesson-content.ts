import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Linking N1 lessons to content posts in database...");
  
  // 1. Fetch N1 lessons
  const lessons = await sql`
    SELECT l.id, l.title, l.code
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE lv.code = 'N1'
  ` as { id: string; title: string; code: string }[];

  console.log(`Found ${lessons.length} N1 lessons in DB.`);

  let insertedCount = 0;

  for (const lesson of lessons) {
    const prefix = `n1-grammar-${lesson.id.slice(0, 8)}-%`;
    // Find corresponding posts
    const posts = await sql`
      SELECT id, slug, title
      FROM posts
      WHERE slug LIKE ${prefix} AND content_type = 'grammar'
      ORDER BY slug
    ` as { id: string; slug: string; title: string }[];

    if (posts.length === 0) {
      console.log(`⚠️ No grammar posts found for N1 lesson ${lesson.code} (${lesson.title}) with prefix ${prefix}`);
      continue;
    }

    let sortOrder = 10;
    for (const post of posts) {
      // Check if link already exists
      const existing = await sql`
        SELECT id FROM curriculum_lesson_content
        WHERE lesson_id = ${lesson.id} AND post_id = ${post.id}
        LIMIT 1
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO curriculum_lesson_content (lesson_id, post_id, content_slug, content_role, sort_order, title)
          VALUES (${lesson.id}, ${post.id}, ${post.slug}, 'main', ${sortOrder}, ${post.title})
        `;
        insertedCount++;
      }
      sortOrder += 10;
    }
  }

  console.log(`Successfully created ${insertedCount} curriculum content links for N1 lessons.`);
}

run().catch(console.error);
