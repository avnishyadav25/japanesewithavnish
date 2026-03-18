import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const LEVELS = ["all", "n5", "n4", "n3", "n2", "n1"] as const;
const PER_LEVEL = 6;

function buildDefaults(
  items: { slug: string; jlpt_level: string | null }[]
): Record<string, string[]> {
  const defaults: Record<string, string[]> = { all: [], n5: [], n4: [], n3: [], n2: [], n1: [] };
  for (const item of items) {
    const levelKey = (item.jlpt_level?.toUpperCase() || "").toLowerCase();
    if (defaults.all.length < PER_LEVEL) defaults.all.push(item.slug);
    if (levelKey && levelKey in defaults && defaults[levelKey].length < PER_LEVEL) {
      defaults[levelKey].push(item.slug);
    }
  }
  return defaults;
}

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const rows = await sql`
      SELECT slug, (jlpt_level)[1] AS jlpt_level FROM posts
      WHERE status = 'published'
        AND content_type IN ('grammar','vocabulary','kanji','reading','writing','listening','sounds','study_guide','practice_test')
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 300
    `;
    const items = (Array.isArray(rows) ? rows : []) as { slug: string; jlpt_level: string | null }[];
    const defaults = buildDefaults(items);
    const out: Record<string, string[]> = {};
    for (const level of LEVELS) {
      out[level] = defaults[level] || [];
    }
    return NextResponse.json(out);
  } catch (e) {
    console.error("Learn recommended defaults:", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
