/**
 * Phase 1: Curriculum Schema Migration
 * - Adds `description`, `access_type`, `content_type` to curriculum_lessons
 * - Creates `curriculum_practices` table
 *
 * Run: npx tsx scripts/migrate-curriculum-schema.ts
 * Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS checks)
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("🔄 Starting curriculum schema migration...\n");

  // ── 1. Add columns to curriculum_lessons ─────────────────────────────────
  console.log("1️⃣  Adding columns to curriculum_lessons...");
  await sql`
    ALTER TABLE curriculum_lessons
      ADD COLUMN IF NOT EXISTS description  TEXT,
      ADD COLUMN IF NOT EXISTS access_type  TEXT NOT NULL DEFAULT 'premium',
      ADD COLUMN IF NOT EXISTS content_type TEXT
  `;

  // Add check constraints (safe with DO $$ / IF NOT EXISTS workaround)
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'curriculum_lessons_access_type_check'
      ) THEN
        ALTER TABLE curriculum_lessons
          ADD CONSTRAINT curriculum_lessons_access_type_check
          CHECK (access_type IN ('free', 'premium'));
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'curriculum_lessons_content_type_check'
      ) THEN
        ALTER TABLE curriculum_lessons
          ADD CONSTRAINT curriculum_lessons_content_type_check
          CHECK (content_type IN (
            'grammar','vocabulary','kanji','reading','listening','mock_test'
          ));
      END IF;
    END $$
  `;
  console.log("   ✓ description, access_type, content_type columns added\n");

  // ── 2. Create curriculum_practices table ──────────────────────────────────
  console.log("2️⃣  Creating curriculum_practices table...");
  await sql`
    CREATE TABLE IF NOT EXISTS curriculum_practices (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id         UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      description       TEXT,
      practice_type     TEXT,
      content_data      JSONB,
      sort_order        INT NOT NULL DEFAULT 0,
      estimated_minutes INT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add check constraint for practice_type
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'curriculum_practices_practice_type_check'
      ) THEN
        ALTER TABLE curriculum_practices
          ADD CONSTRAINT curriculum_practices_practice_type_check
          CHECK (practice_type IN (
            'writing_canvas','mcq','fill_blank','roleplay','listening','shadowing'
          ));
      END IF;
    END $$
  `;

  // Create index on lesson_id
  await sql`
    CREATE INDEX IF NOT EXISTS curriculum_practices_lesson_idx
      ON curriculum_practices(lesson_id)
  `;
  console.log("   ✓ curriculum_practices table created with index\n");

  // ── 3. Verify results ─────────────────────────────────────────────────────
  console.log("3️⃣  Verifying schema...");

  const lessonCols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'curriculum_lessons'
      AND column_name IN ('description', 'access_type', 'content_type')
    ORDER BY column_name
  `;
  console.log("   curriculum_lessons new columns:");
  for (const col of lessonCols as { column_name: string; data_type: string; column_default: string | null; is_nullable: string }[]) {
    console.log(`     • ${col.column_name} (${col.data_type}) default=${col.column_default} nullable=${col.is_nullable}`);
  }

  const practiceTableCheck = await sql`
    SELECT COUNT(*) AS cnt FROM information_schema.tables
    WHERE table_name = 'curriculum_practices'
  `;
  const exists = (practiceTableCheck as { cnt: string }[])[0]?.cnt === "1";
  console.log(`   curriculum_practices table: ${exists ? "✓ exists" : "✗ NOT found"}\n`);

  console.log("✅ Migration complete!");
}

migrate().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
