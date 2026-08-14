import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type SearchResult = {
  type: "blog" | "vocabulary" | "grammar" | "kanji" | "lesson";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || !sql) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;

  try {
    const [postRows, lessonRows] = await Promise.all([
      sql`
        SELECT slug, title, summary, content_type
        FROM posts
        WHERE status = 'published'
          AND content_type IN ('blog', 'vocabulary', 'grammar', 'kanji')
          AND title ILIKE ${pattern}
        ORDER BY published_at DESC NULLS LAST
        LIMIT 8
      `,
      sql`
        SELECT l.id, l.title, sm.title AS submodule_title
        FROM curriculum_lessons l
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        WHERE l.title ILIKE ${pattern}
        LIMIT 5
      `,
    ]);

    const results: SearchResult[] = [];

    for (const row of postRows as { slug: string; title: string; summary: string | null; content_type: string }[]) {
      const type = (["vocabulary", "grammar", "kanji"].includes(row.content_type) ? row.content_type : "blog") as SearchResult["type"];
      const href = row.content_type === "blog" ? `/blog/${row.slug}` : `/learn/${row.content_type}/${row.slug}`;
      results.push({ type, title: row.title, subtitle: row.summary, href });
    }

    for (const row of lessonRows as { id: string; title: string; submodule_title: string }[]) {
      results.push({
        type: "lesson",
        title: row.title,
        subtitle: row.submodule_title,
        href: `/learn/curriculum/lesson/${row.id}`,
      });
    }

    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (e) {
    console.error("Search error:", e);
    return NextResponse.json({ results: [] });
  }
}
