import { sql } from "@/lib/db";

/**
 * Mirrors scripts/sync-type-tables-from-posts.ts field-mapping so admin edits take effect
 * immediately on the live site, instead of requiring someone to remember to run that CLI
 * script afterward (P0-4/5/6 prerequisite fix — the admin editor only wrote to `posts`).
 */

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
    const parts = v.split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
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

export async function syncPostToTypeTable(post: {
  id: string;
  content_type: string;
  title: string;
  jlpt_level: string[] | null;
  meta: unknown;
}): Promise<void> {
  if (!sql) return;
  const meta = post.meta && typeof post.meta === "object" && !Array.isArray(post.meta) ? (post.meta as Record<string, unknown>) : {};

  if (post.content_type === "vocabulary") {
    const word = asString(meta.word ?? meta.term ?? meta.vocabulary ?? meta.kanji);
    const reading = asString(meta.reading ?? meta.pronunciation ?? meta.kana ?? meta.furigana);
    const meaning = asString(meta.meaning ?? meta.definition ?? meta.translation ?? meta.english);
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO vocabulary (post_id, word, reading, meaning, notes, updated_at)
      VALUES (${post.id}, ${word}, ${reading}, ${meaning}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        word = EXCLUDED.word, reading = EXCLUDED.reading, meaning = EXCLUDED.meaning,
        notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }

  if (post.content_type === "grammar") {
    const pattern = asString(meta.pattern ?? meta.title ?? post.title);
    const structure = asString(meta.structure ?? meta.formula ?? meta.usage);
    const level = asString(meta.level ?? (Array.isArray(post.jlpt_level) ? post.jlpt_level[0] : null));
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
      VALUES (${post.id}, ${pattern}, ${structure}, ${level}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        pattern = EXCLUDED.pattern, structure = EXCLUDED.structure, level = EXCLUDED.level,
        notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }

  if (post.content_type === "kanji") {
    const character = asString(meta.character ?? meta.kanji ?? meta.word ?? post.title);
    const onyomi = asStringArray(meta.onyomi ?? meta.on ?? meta.on_readings);
    const kunyomi = asStringArray(meta.kunyomi ?? meta.kun ?? meta.kun_readings);
    const strokeCount = asInt(meta.stroke_count ?? meta.strokes);
    const meaning = asString(meta.meaning ?? meta.definition ?? meta.english);
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, updated_at)
      VALUES (${post.id}, ${character}, ${onyomi}, ${kunyomi}, ${strokeCount}, ${meaning}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        character = EXCLUDED.character, onyomi = EXCLUDED.onyomi, kunyomi = EXCLUDED.kunyomi,
        stroke_count = EXCLUDED.stroke_count, meaning = EXCLUDED.meaning, notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }

  if (post.content_type === "reading") {
    const title = asString(meta.title ?? post.title);
    const level = asString(meta.level ?? (Array.isArray(post.jlpt_level) ? post.jlpt_level[0] : null));
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO reading (post_id, title, level, notes, updated_at)
      VALUES (${post.id}, ${title}, ${level}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        title = EXCLUDED.title, level = EXCLUDED.level, notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }

  if (post.content_type === "listening") {
    const title = asString(meta.title ?? post.title);
    const level = asString(meta.level ?? (Array.isArray(post.jlpt_level) ? post.jlpt_level[0] : null));
    const audioUrl = asString(meta.audio_url ?? meta.audioUrl ?? meta.audio);
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO listening (post_id, title, level, audio_url, notes, updated_at)
      VALUES (${post.id}, ${title}, ${level}, ${audioUrl}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        title = EXCLUDED.title, level = EXCLUDED.level, audio_url = EXCLUDED.audio_url,
        notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }
}
