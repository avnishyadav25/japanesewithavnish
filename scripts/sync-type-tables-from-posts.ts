/**
 * One-time (idempotent) sync: posts.meta -> type tables.
 *
 * Why: Admin pickers + lesson link routes query type tables (vocabulary/grammar/kanji/reading/listening),
 * but the source of truth is currently `posts` (content_type + meta).
 *
 * Run:
 *   npm run sync:type-tables
 *   npm run sync:type-tables -- --dry-run
 *   npm run sync:type-tables -- --types vocabulary,grammar
 *   npm run sync:type-tables -- --only-status published
 *
 * Requires: DATABASE_URL in env/.env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

type SyncType = "vocabulary" | "grammar" | "kanji" | "reading" | "listening";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function hasFlag(argv: string[], flag: string) {
  return argv.includes(flag);
}
function getArgValue(argv: string[], key: string): string | null {
  const idx = argv.findIndex((a) => a === key || a.startsWith(key + "="));
  if (idx === -1) return null;
  const a = argv[idx];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return argv[idx + 1] ?? null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asStringArray(v: unknown): string[] | null {
  if (Array.isArray(v)) {
    const out = v.map((x) => asString(x)).filter(Boolean) as string[];
    return out.length ? out : null;
  }
  if (typeof v === "string") {
    const parts = v
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }
  return null;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function pickMeta(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const onlyStatusRaw = getArgValue(argv, "--only-status"); // "published" | "draft" | "all"
  const onlyStatus =
    onlyStatusRaw === "published" || onlyStatusRaw === "draft"
      ? onlyStatusRaw
      : null;

  const typesRaw = getArgValue(argv, "--types");
  const requestedTypes = (typesRaw ? typesRaw.split(",") : ["vocabulary", "grammar", "kanji", "reading", "listening"])
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t): t is SyncType =>
      t === "vocabulary" || t === "grammar" || t === "kanji" || t === "reading" || t === "listening"
    )
    .filter((t, idx, arr) => arr.indexOf(t) === idx);

  console.log("Sync type tables from posts");
  console.log("dryRun:", dryRun);
  console.log("types:", requestedTypes.join(", "));
  console.log("onlyStatus:", onlyStatus ?? "any");

  const whereStatus = onlyStatus ? sql`AND p.status = ${onlyStatus}` : sql``;

  const posts = (await sql`
    SELECT p.id, p.content_type, p.title, p.slug, p.status, p.jlpt_level, p.meta
    FROM posts p
    WHERE p.content_type = ANY(${requestedTypes}::text[])
      ${whereStatus}
  `) as {
    id: string;
    content_type: SyncType;
    title: string;
    slug: string;
    status: string;
    jlpt_level: string[] | null;
    meta: unknown;
  }[];

  console.log("posts matched:", posts.length);
  if (!posts.length) return;

  const counts: Record<SyncType, number> = {
    vocabulary: 0,
    grammar: 0,
    kanji: 0,
    reading: 0,
    listening: 0,
  };

  for (const p of posts) {
    const meta = pickMeta(p.meta);

    if (p.content_type === "vocabulary") {
      const word = asString(meta.word ?? meta.term ?? meta.vocabulary ?? meta.kanji);
      const reading = asString(meta.reading ?? meta.pronunciation ?? meta.kana ?? meta.furigana);
      const meaning = asString(meta.meaning ?? meta.definition ?? meta.translation ?? meta.english);
      const notes = asString(meta.notes ?? meta.note ?? meta.hint);
      if (dryRun) {
        counts.vocabulary += 1;
        continue;
      }
      await sql`
        INSERT INTO vocabulary (post_id, word, reading, meaning, notes, updated_at)
        VALUES (${p.id}, ${word}, ${reading}, ${meaning}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET
          word = EXCLUDED.word,
          reading = EXCLUDED.reading,
          meaning = EXCLUDED.meaning,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
      counts.vocabulary += 1;
      continue;
    }

    if (p.content_type === "grammar") {
      const pattern = asString(meta.pattern ?? meta.title ?? p.title);
      const structure = asString(meta.structure ?? meta.formula ?? meta.usage);
      const level = asString(meta.level ?? (Array.isArray(p.jlpt_level) ? p.jlpt_level[0] : null));
      const notes = asString(meta.notes ?? meta.note ?? meta.hint);
      if (dryRun) {
        counts.grammar += 1;
        continue;
      }
      await sql`
        INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
        VALUES (${p.id}, ${pattern}, ${structure}, ${level}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET
          pattern = EXCLUDED.pattern,
          structure = EXCLUDED.structure,
          level = EXCLUDED.level,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
      counts.grammar += 1;
      continue;
    }

    if (p.content_type === "kanji") {
      const character = asString(meta.character ?? meta.kanji ?? meta.word ?? p.title);
      const onyomi = asStringArray(meta.onyomi ?? meta.on ?? meta.on_readings);
      const kunyomi = asStringArray(meta.kunyomi ?? meta.kun ?? meta.kun_readings);
      const strokeCount = asInt(meta.stroke_count ?? meta.strokes);
      const meaning = asString(meta.meaning ?? meta.definition ?? meta.english);
      const notes = asString(meta.notes ?? meta.note ?? meta.hint);
      if (dryRun) {
        counts.kanji += 1;
        continue;
      }
      await sql`
        INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, updated_at)
        VALUES (${p.id}, ${character}, ${onyomi}, ${kunyomi}, ${strokeCount}, ${meaning}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET
          character = EXCLUDED.character,
          onyomi = EXCLUDED.onyomi,
          kunyomi = EXCLUDED.kunyomi,
          stroke_count = EXCLUDED.stroke_count,
          meaning = EXCLUDED.meaning,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
      counts.kanji += 1;
      continue;
    }

    if (p.content_type === "reading") {
      const title = asString(meta.title ?? p.title);
      const level = asString(meta.level ?? (Array.isArray(p.jlpt_level) ? p.jlpt_level[0] : null));
      const notes = asString(meta.notes ?? meta.note ?? meta.hint);
      if (dryRun) {
        counts.reading += 1;
        continue;
      }
      await sql`
        INSERT INTO reading (post_id, title, level, notes, updated_at)
        VALUES (${p.id}, ${title}, ${level}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET
          title = EXCLUDED.title,
          level = EXCLUDED.level,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
      counts.reading += 1;
      continue;
    }

    if (p.content_type === "listening") {
      const title = asString(meta.title ?? p.title);
      const level = asString(meta.level ?? (Array.isArray(p.jlpt_level) ? p.jlpt_level[0] : null));
      const audioUrl = asString(meta.audio_url ?? meta.audioUrl ?? meta.audio);
      const notes = asString(meta.notes ?? meta.note ?? meta.hint);
      if (dryRun) {
        counts.listening += 1;
        continue;
      }
      await sql`
        INSERT INTO listening (post_id, title, level, audio_url, notes, updated_at)
        VALUES (${p.id}, ${title}, ${level}, ${audioUrl}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET
          title = EXCLUDED.title,
          level = EXCLUDED.level,
          audio_url = EXCLUDED.audio_url,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
      counts.listening += 1;
      continue;
    }
  }

  console.log("done. upserted:");
  for (const [k, v] of Object.entries(counts)) console.log(`- ${k}: ${v}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

