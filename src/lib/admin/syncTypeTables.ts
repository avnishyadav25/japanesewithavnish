import { sql } from "@/lib/db";

/**
 * Mirrors scripts/sync-type-tables-from-posts.ts field-mapping so admin edits take effect
 * immediately on the live site, instead of requiring someone to remember to run that CLI
 * script afterward (P0-4/5/6 prerequisite fix — the admin editor only wrote to `posts`).
 */

export function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function asStringArray(v: unknown): string[] | null {
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

export function asInt(v: unknown): number | null {
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
    const word = asString(meta.word ?? meta.japanese ?? meta.term ?? meta.vocabulary ?? meta.kanji);
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

  if (post.content_type === "writing") {
    const title = asString(meta.title ?? post.title);
    const level = asString(meta.level ?? (Array.isArray(post.jlpt_level) ? post.jlpt_level[0] : null));
    const notes = asString(meta.notes ?? meta.note ?? meta.hint);
    await sql`
      INSERT INTO writing (post_id, title, level, notes, updated_at)
      VALUES (${post.id}, ${title}, ${level}, ${notes}, NOW())
      ON CONFLICT (post_id) DO UPDATE SET
        title = EXCLUDED.title, level = EXCLUDED.level, notes = EXCLUDED.notes, updated_at = NOW()
    `;
    return;
  }

  if (post.content_type === "practice_test") {
    // Legacy meta.pdf_url (the old PDF-link-only editor) becomes the initial pdf_url on
    // first save; the new PracticeTestBuilder editor persists everything else directly via
    // applySidecarOverrides below. ON CONFLICT DO NOTHING on subsequent saves — the sidecar
    // row's real columns, once set, must not be clobbered back to meta's stale values.
    const pdfUrl = asString(meta.pdf_url);
    await sql`
      INSERT INTO practice_tests (post_id, pdf_url, updated_at)
      VALUES (${post.id}, ${pdfUrl}, NOW())
      ON CONFLICT (post_id) DO NOTHING
    `;
    return;
  }
}

/**
 * Called after syncPostToTypeTable() for content types with a dedicated editor
 * (vocabulary/grammar/kanji so far) — persists structured fields the editor
 * collected directly into the sidecar table's real columns, taking precedence
 * over the generic meta-parsing sync above. Field allowlist per type prevents
 * writing arbitrary columns from request input. Requires the sidecar row to
 * already exist (syncPostToTypeTable creates it via ON CONFLICT upsert).
 */
export async function applySidecarOverrides(type: string, postId: string, sidecar: Record<string, unknown>): Promise<void> {
  if (!sql) return;

  if (type === "vocabulary") {
    const word = asString(sidecar.word);
    const reading = asString(sidecar.reading);
    const romaji = asString(sidecar.romaji);
    const meaning = asString(sidecar.meaning);
    const partOfSpeech = asString(sidecar.part_of_speech);
    const transitivity = asString(sidecar.transitivity);
    const notes = asString(sidecar.notes);
    await sql`
      UPDATE vocabulary SET
        word = COALESCE(${word}, word),
        reading = COALESCE(${reading}, reading),
        romaji = COALESCE(${romaji}, romaji),
        meaning = COALESCE(${meaning}, meaning),
        part_of_speech = COALESCE(${partOfSpeech}, part_of_speech),
        transitivity = COALESCE(${transitivity}, transitivity),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE post_id = ${postId}
    `;
    return;
  }

  if (type === "grammar") {
    const pattern = asString(sidecar.pattern);
    const structure = asString(sidecar.structure);
    const meaning = asString(sidecar.meaning);
    const whenToUse = asString(sidecar.when_to_use);
    const notes = asString(sidecar.notes);
    await sql`
      UPDATE grammar SET
        pattern = COALESCE(${pattern}, pattern),
        structure = COALESCE(${structure}, structure),
        meaning = COALESCE(${meaning}, meaning),
        when_to_use = COALESCE(${whenToUse}, when_to_use),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE post_id = ${postId}
    `;
    return;
  }

  if (type === "kanji") {
    const character = asString(sidecar.character);
    const meaning = asString(sidecar.meaning);
    const meaningExtended = asString(sidecar.meaning_extended);
    const onyomi = asStringArray(sidecar.onyomi);
    const kunyomi = asStringArray(sidecar.kunyomi);
    const strokeCount = asInt(sidecar.stroke_count);
    const notes = asString(sidecar.notes);
    await sql`
      UPDATE kanji SET
        character = COALESCE(${character}, character),
        meaning = COALESCE(${meaning}, meaning),
        meaning_extended = COALESCE(${meaningExtended}, meaning_extended),
        onyomi = COALESCE(${onyomi}, onyomi),
        kunyomi = COALESCE(${kunyomi}, kunyomi),
        stroke_count = COALESCE(${strokeCount}, stroke_count),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE post_id = ${postId}
    `;
    return;
  }

  if (type === "practice_test") {
    const durationMinutes = asInt(sidecar.duration_minutes);
    const passingScorePercent = asInt(sidecar.passing_score_percent);
    const instructions = asString(sidecar.instructions);
    const pdfUrl = asString(sidecar.pdf_url);
    const testVariant = asString(sidecar.test_variant);
    const attemptPolicy = asString(sidecar.attempt_policy);
    await sql`
      UPDATE practice_tests SET
        duration_minutes = COALESCE(${durationMinutes}, duration_minutes),
        passing_score_percent = COALESCE(${passingScorePercent}, passing_score_percent),
        instructions = COALESCE(${instructions}, instructions),
        pdf_url = COALESCE(${pdfUrl}, pdf_url),
        test_variant = COALESCE(${testVariant}, test_variant),
        attempt_policy = COALESCE(${attemptPolicy}, attempt_policy),
        updated_at = NOW()
      WHERE post_id = ${postId}
    `;
    return;
  }
}
