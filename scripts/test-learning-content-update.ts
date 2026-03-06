/**
 * Verify learning_content UPDATE persists content.
 * Run with: npx tsx scripts/test-learning-content-update.ts
 * Env: DATABASE_URL (e.g. from .env)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(repoRoot: string): void {
  const p = resolve(repoRoot, ".env");
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const REPO_ROOT = resolve(__dirname, "..");
loadEnv(REPO_ROOT);

async function main() {
  const { sql } = await import("../src/lib/db");
  if (!sql) {
    console.error("DATABASE_URL not set. Skipping test.");
    process.exit(0);
  }

  const marker = "TEST_LEARNING_CONTENT_UPDATE_" + Date.now();
  const rows = await sql`
    SELECT content_type, slug, content
    FROM learning_content
    LIMIT 1
  `;
  if (!rows.length) {
    console.log("No learning_content rows. Skipping.");
    process.exit(0);
  }

  const row = rows[0] as { content_type: string; slug: string; content: string | null };
  const { content_type, slug } = row;
  const previousContent = row.content ?? "";

  await sql`
    UPDATE learning_content SET
      content = ${marker},
      updated_at = ${new Date().toISOString()}
    WHERE content_type = ${content_type} AND slug = ${slug}
  `;

  const updated = await sql`
    SELECT content FROM learning_content
    WHERE content_type = ${content_type} AND slug = ${slug}
  `;
  const newContent = (updated[0] as { content: string | null })?.content ?? "";
  if (newContent !== marker) {
    console.error("FAIL: content not persisted. Got:", newContent?.slice(0, 80));
    process.exit(1);
  }

  // Restore original content
  await sql`
    UPDATE learning_content SET
      content = ${previousContent},
      updated_at = ${new Date().toISOString()}
    WHERE content_type = ${content_type} AND slug = ${slug}
  `;

  console.log("OK: learning_content content update verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
