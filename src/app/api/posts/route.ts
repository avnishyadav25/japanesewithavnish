import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const VALID_LEVELS = ["n5", "n4", "n3", "n2", "n1", "mega"] as const;
const VALID_TYPES = ["all", "grammar", "vocabulary", "kanji", "reading", "listening", "tips", "roadmap"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level")?.toLowerCase() || "n5";
  const type = searchParams.get("type")?.toLowerCase() || "all";
  const search = searchParams.get("search")?.trim() || "";

  if (!VALID_LEVELS.includes(level as (typeof VALID_LEVELS)[number])) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  let posts: { id: string; slug: string; title: string; summary?: string; jlpt_level?: unknown; tags?: unknown; published_at?: string }[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, slug, title, summary, jlpt_level, tags, published_at
      FROM posts WHERE status = 'published'
      ORDER BY published_at DESC LIMIT 100
    `;
    posts = (rows ?? []) as typeof posts;
  }

  const levels = (l: unknown): string[] =>
    Array.isArray(l) ? l.map((x) => String(x).toUpperCase()) : l ? [String(l).toUpperCase()] : [];

  let filtered = (posts || []).filter((p) => {
    const postLevels = levels(p.jlpt_level);
    if (level === "mega") {
      return postLevels.some((pl) => ["N5", "N4", "N3", "N2", "N1"].includes(pl));
    }
    return postLevels.includes(level.toUpperCase());
  });

  // Filter by type (tags)
  if (type !== "all") {
    const typeNorm = type === "vocab" ? "vocabulary" : type;
    filtered = filtered.filter((p) => {
      const tags = (p.tags as string[]) || [];
      return tags.some((t) => t.toLowerCase().includes(typeNorm));
    });
  }

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.summary || "").toLowerCase().includes(q) ||
        ((p.tags as string[]) || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ posts: filtered });
}
