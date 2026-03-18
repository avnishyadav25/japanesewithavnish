import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** GET /api/learn/reading/[slug] — reading post content + glossary for tap-for-definition. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const postRows = await sql`
      SELECT id, title, content, meta, slug
      FROM posts
      WHERE slug = ${slug} AND content_type = 'reading' AND status = 'published'
      LIMIT 1
    ` as { id: string; title: string; content: string | null; meta: unknown; slug: string }[];
    const post = postRows[0];
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const glossaryRows = await sql`
      SELECT id, segment_text, segment_start, segment_end, definition_text, vocabulary_id, grammar_id
      FROM reading_glossary
      WHERE post_id = ${post.id}
      ORDER BY segment_start
    ` as { id: string; segment_text: string; segment_start: number; segment_end: number; definition_text: string | null; vocabulary_id: string | null; grammar_id: string | null }[];
    const glossary = glossaryRows.map((g) => ({
      id: g.id,
      segmentText: g.segment_text,
      segmentStart: g.segment_start,
      segmentEnd: g.segment_end,
      definitionText: g.definition_text,
      vocabularyId: g.vocabulary_id,
      grammarId: g.grammar_id,
    }));
    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        meta: post.meta,
        slug: post.slug,
      },
      glossary,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load reading" }, { status: 500 });
  }
}
