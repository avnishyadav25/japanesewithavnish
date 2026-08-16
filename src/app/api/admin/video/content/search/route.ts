import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { publicUrlFor } from "@/lib/video/scopeResolver";

/**
 * Finds published items to add to a video by hand.
 *
 * Backs the item picker's "add" box. Deliberately searches the Japanese and the English —
 * you might know the word you want either way round — and returns the public URL so the picker
 * can link to the page and you can read it before committing it to a video.
 *
 * Word-boundary matching on the meaning, substring on the Japanese: 'cat' as a substring returns
 * category/indicate/educate (96 rows against this database, 2 with boundaries), while a substring
 * search on kana or kanji is exactly what you want — typing 一 should find 一つ.
 */
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const contentType = url.searchParams.get("contentType") ?? null;
  const jlptLevel = url.searchParams.get("jlptLevel") ?? null;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  if (q.length < 1) return NextResponse.json({ items: [] });

  const like = `%${q}%`;
  const word = `\\y${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\y`;

  const rows = (await sql`
    SELECT * FROM (
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             v.word, v.reading, v.meaning
      FROM vocabulary v JOIN posts p ON p.id = v.post_id
      WHERE p.status = 'published'
        AND (v.word ILIKE ${like} OR v.reading ILIKE ${like} OR v.romaji ILIKE ${like}
             OR v.meaning ~* ${word} OR p.title ILIKE ${like})
      UNION ALL
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             k.character AS word, array_to_string(k.kunyomi, ', ') AS reading, k.meaning
      FROM kanji k JOIN posts p ON p.id = k.post_id
      WHERE p.status = 'published'
        AND (k.character ILIKE ${like} OR k.meaning ~* ${word} OR p.title ILIKE ${like})
      UNION ALL
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             g.pattern AS word, g.pattern_romaji AS reading, g.meaning
      FROM grammar g JOIN posts p ON p.id = g.post_id
      WHERE p.status = 'published'
        AND (g.pattern ILIKE ${like} OR g.meaning ~* ${word} OR p.title ILIKE ${like})
      UNION ALL
      -- Types with no sidecar (reading, listening, writing, sounds, study_guide) match on the
      -- post itself, so the picker can still reach them.
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             NULL::text AS word, NULL::text AS reading, p.summary AS meaning
      FROM posts p
      WHERE p.status = 'published'
        AND p.content_type NOT IN ('vocabulary', 'kanji', 'grammar')
        AND p.title ILIKE ${like}
    ) hits
    WHERE (${contentType}::text IS NULL OR hits.content_type = ${contentType})
      AND (${jlptLevel}::text IS NULL OR hits.jlpt_level = ${jlptLevel})
    -- Beginner-first, then tightest definition. Ordering on the level string alone puts N1 first,
    -- which is exactly backwards for this audience.
    ORDER BY CASE hits.jlpt_level WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3
                                  WHEN 'N2' THEN 4 WHEN 'N1' THEN 5 ELSE 6 END,
             length(COALESCE(hits.meaning, '')),
             hits.title
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return NextResponse.json({
    items: rows.map((r) => ({
      postId: String(r.id),
      contentType: String(r.content_type),
      title: String(r.title),
      word: (r.word as string | null) ?? undefined,
      reading: (r.reading as string | null) ?? undefined,
      meaning: (r.meaning as string | null) ?? undefined,
      jlptLevel: (r.jlpt_level as string | null) ?? undefined,
      slug: String(r.slug),
      url: publicUrlFor(String(r.content_type), String(r.slug)),
      source: "library",
    })),
  });
}
