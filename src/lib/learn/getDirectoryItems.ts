import { sql } from "@/lib/db";
import { getCompleteListeningPostIds } from "@/lib/learn/listeningPublishGate";

export interface DirectoryItem {
  id: string;
  title: string;
  slug?: string;
  subtitle?: string; // Romaji or reading
  romaji?: string;
  meaning?: string;
  notes?: string;
  level?: string;
  strokeCount?: number | null;
  onyomi?: string[] | null;
  kunyomi?: string[] | null;
  type?: string; // Used for writing (kana vs kanji)
  partOfSpeech?: string | null; // Vocabulary only
  learned?: boolean; // Vocabulary only, session-aware
  reviewDue?: boolean; // Vocabulary only, session-aware
}

const KANJI_RE = /[一-龯]/;

export async function getDirectoryItems(
  contentType: "grammar" | "vocabulary" | "kanji" | "listening" | "writing",
  level: string,
  sessionEmail?: string | null
): Promise<DirectoryItem[]> {
  if (!sql) return [];
  const normalizedLevel = level.toUpperCase();

  try {
    if (contentType === "grammar") {
      const rows = (await sql`
        SELECT g.id, g.pattern as title, g.notes, p.title as post_title, p.slug
        FROM grammar g
        JOIN posts p ON g.post_id = p.id
        WHERE p.jlpt_level[1] = ${normalizedLevel}
        ORDER BY g.pattern ASC
        LIMIT 200
      `) as { id: string; title: string | null; notes: string | null; post_title: string; slug: string }[];

      return (rows || []).map((r) => ({
        id: r.id,
        title: r.title || r.post_title,
        slug: r.slug,
        notes: r.notes || "",
        level: normalizedLevel,
      }));
    }

    if (contentType === "vocabulary") {
      const rows = (await sql`
        SELECT v.id, v.word as title, v.reading as subtitle, v.romaji, v.meaning, v.notes, v.part_of_speech, p.slug
        FROM vocabulary v
        JOIN posts p ON v.post_id = p.id
        WHERE v.jlpt_level = ${normalizedLevel} OR p.jlpt_level[1] = ${normalizedLevel}
        ORDER BY coalesce(v.romaji, v.reading, v.word) ASC, v.word ASC
        LIMIT 2000
      `) as { id: string; title: string; subtitle: string; romaji: string | null; meaning: string; notes: string | null; part_of_speech: string | null; slug: string }[];

      // Session-aware learned / review-due status, keyed the same way the existing
      // "Mark as learned" + review-queue feature already keys vocabulary (content_slug).
      let learnedSlugs = new Set<string>();
      let dueSlugs = new Set<string>();
      if (sessionEmail) {
        const slugs = (rows || []).map((r) => r.slug).filter(Boolean);
        if (slugs.length > 0) {
          const [learnedRows, dueRows] = await Promise.all([
            sql`
              SELECT content_slug FROM user_learning_progress
              WHERE user_email = ${sessionEmail} AND status = 'learned' AND content_slug = ANY(${slugs})
            `,
            sql`
              SELECT item_id FROM review_schedule
              WHERE user_email = ${sessionEmail} AND item_type = 'vocab' AND next_review_at <= NOW() AND item_id = ANY(${slugs})
            `,
          ]);
          learnedSlugs = new Set((learnedRows as { content_slug: string }[]).map((r) => r.content_slug));
          dueSlugs = new Set((dueRows as { item_id: string }[]).map((r) => r.item_id));
        }
      }

      return (rows || []).map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        romaji: r.romaji || "",
        meaning: r.meaning,
        notes: r.notes || "",
        partOfSpeech: r.part_of_speech,
        slug: r.slug,
        level: normalizedLevel,
        type: KANJI_RE.test(r.title) ? "kanji_word" : "kana_word",
        learned: learnedSlugs.has(r.slug),
        reviewDue: dueSlugs.has(r.slug),
      }));
    }

    if (contentType === "kanji") {
      const rows = (await sql`
        SELECT k.id, k.character as title, k.meaning, k.stroke_count, k.onyomi, k.kunyomi, p.slug
        FROM kanji k
        JOIN posts p ON k.post_id = p.id
        WHERE p.jlpt_level[1] = ${normalizedLevel}
        ORDER BY k.character ASC
        LIMIT 200
      `) as { id: string; title: string; meaning: string | null; stroke_count: number | null; onyomi: string[] | null; kunyomi: string[] | null; slug: string }[];

      return (rows || []).map((r) => ({
        id: r.id,
        title: r.title,
        meaning: r.meaning || "",
        strokeCount: r.stroke_count,
        onyomi: r.onyomi,
        kunyomi: r.kunyomi,
        slug: r.slug,
        level: normalizedLevel,
      }));
    }

    if (contentType === "listening") {
      const rows = (await sql`
        SELECT l.id, l.post_id, l.title, l.audio_url, l.notes, p.slug
        FROM listening l
        JOIN posts p ON l.post_id = p.id
        WHERE p.jlpt_level[1] = ${normalizedLevel}
        ORDER BY l.title ASC
        LIMIT 100
      `) as { id: string; post_id: string; title: string; audio_url: string; notes: string | null; slug: string }[];

      // Only surface activities that are actually publish-ready (real audio,
      // transcript, and enough questions) — otherwise the card is a dead end.
      const completeIds = await getCompleteListeningPostIds();
      const readyRows = (rows || []).filter((r) => completeIds.has(r.post_id));

      return readyRows.map((r) => ({
        id: r.id,
        title: r.title,
        meaning: r.notes || "", // Description/Notes
        notes: r.audio_url || "", // Audio url
        slug: r.slug,
        level: normalizedLevel,
      }));
    }

    if (contentType === "writing") {
      // Writing practice:
      // For N5: Hiragana & Katakana from kana table + N5 Kanji
      // For N4-N1: Kanji from kanji table
      if (normalizedLevel === "N5") {
        const kanaRows = (await sql`
          SELECT id, character as title, romaji as subtitle, type, stroke_count
          FROM kana
          ORDER BY type ASC, sort_order ASC
        `) as { id: string; title: string; subtitle: string; type: string; stroke_count: number | null }[];

        const kanjiRows = (await sql`
          SELECT k.id, k.character as title, k.meaning, k.stroke_count, p.slug
          FROM kanji k
          JOIN posts p ON k.post_id = p.id
          WHERE p.jlpt_level[1] = 'N5'
          ORDER BY k.character ASC
        `) as { id: string; title: string; meaning: string | null; stroke_count: number | null; slug: string }[];

        const kanaItems = (kanaRows || []).map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          meaning: `${r.type.charAt(0).toUpperCase() + r.type.slice(1)} character`,
          type: r.type, // 'hiragana' or 'katakana'
          strokeCount: r.stroke_count,
          level: "N5",
        }));

        const kanjiItems = (kanjiRows || []).map((r) => ({
          id: r.id,
          title: r.title,
          meaning: r.meaning || "",
          type: "kanji",
          strokeCount: r.stroke_count,
          slug: r.slug,
          level: "N5",
        }));

        return [...kanaItems, ...kanjiItems];
      } else {
        const kanjiRows = (await sql`
          SELECT k.id, k.character as title, k.meaning, k.stroke_count, p.slug
          FROM kanji k
          JOIN posts p ON k.post_id = p.id
          WHERE p.jlpt_level[1] = ${normalizedLevel}
          ORDER BY k.character ASC
        `) as { id: string; title: string; meaning: string | null; stroke_count: number | null; slug: string }[];

        return (kanjiRows || []).map((r) => ({
          id: r.id,
          title: r.title,
          meaning: r.meaning || "",
          type: "kanji",
          strokeCount: r.stroke_count,
          slug: r.slug,
          level: normalizedLevel,
        }));
      }
    }
  } catch (err) {
    console.error("[getDirectoryItems] Error:", err);
  }

  return [];
}
