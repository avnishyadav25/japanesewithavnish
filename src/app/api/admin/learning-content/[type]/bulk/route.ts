import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";

type BulkItem = {
  title?: string;
  slug?: string;
  meta?: Record<string, unknown>;
  jlpt_level?: string | null;
  tags?: string[];
  status?: string;
  sort_order?: number;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type } = await params;
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const body = await req.json();
    const {
      items,
      override = false,
      jlpt_level: defaultJlpt,
    }: { items: BulkItem[]; override?: boolean; jlpt_level?: string | null } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const existingRows = (await sql`
      SELECT slug FROM learning_content WHERE content_type = ${type}
    `) as { slug: string }[];
    const existingSlugs = new Set((existingRows ?? []).map((r) => r.slug));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const slug = it.slug != null ? String(it.slug).trim() : "";
      const title = it.title != null ? String(it.title).trim() : slug || `Item ${i + 1}`;
      if (!slug) {
        skipped++;
        errors.push(`Item ${i + 1}: missing slug`);
        continue;
      }

      const metaVal =
        it.meta != null && typeof it.meta === "object" && !Array.isArray(it.meta)
          ? JSON.stringify(it.meta)
          : "{}";
      const jlpt = it.jlpt_level ?? defaultJlpt ?? null;
      const tags = Array.isArray(it.tags) ? it.tags : [];
      const statusVal = it.status === "published" ? "published" : "draft";
      const sortOrderVal = typeof it.sort_order === "number" ? it.sort_order : i;

      if (existingSlugs.has(slug)) {
        if (override) {
          try {
            await sql`
              UPDATE learning_content SET
                title = ${title},
                content = COALESCE(content, ''),
                jlpt_level = ${jlpt},
                tags = ${tags},
                meta = ${metaVal}::jsonb,
                status = ${statusVal},
                sort_order = ${sortOrderVal},
                updated_at = ${new Date().toISOString()}
              WHERE content_type = ${type} AND slug = ${slug}
            `;
            updated++;
          } catch {
            errors.push(`Item ${i + 1} (${slug}): update failed`);
          }
        } else {
          skipped++;
        }
        continue;
      }

      try {
        await sql`
          INSERT INTO learning_content (content_type, slug, title, content, jlpt_level, tags, meta, status, sort_order)
          VALUES (${type}, ${slug}, ${title}, '', ${jlpt}, ${tags}, ${metaVal}::jsonb, ${statusVal}, ${sortOrderVal})
        `;
        existingSlugs.add(slug);
        created++;
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e?.code === "23505") {
          skipped++;
        } else {
          errors.push(`Item ${i + 1} (${slug}): ${String(err)}`);
        }
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Learning content bulk:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
