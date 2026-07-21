import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";
import { syncPostToTypeTable, applySidecarOverrides } from "@/lib/admin/syncTypeTables";
import { getPublishGateStatus } from "@/lib/contentReview/publishGate";
import { getContentBlockPublishGateStatus } from "@/lib/blocks/publishGate";
import { queueReReviewOnEdit } from "@/lib/contentReview/contentEditTrigger";
import { isReviewEntityType } from "@/lib/contentReview/types";

// [slug] here isn't the final path segment for the page routes that link to
// this API (…/edit), and Next.js only auto-decodes a dynamic segment when it's
// terminal — so route params can arrive still percent-encoded for non-ASCII
// slugs. This route itself IS terminal, but decode defensively anyway since a
// client fetch() built from an already-decoded slug should still round-trip
// safely (decodeURIComponent on text with no "%" sequences is a no-op).
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, slug: rawSlug } = await params;
    const slug = decodeSlug(rawSlug);
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const rows = await sql`
      SELECT id, slug, title, content, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, updated_at
      FROM posts
      WHERE content_type = ${type} AND slug = ${slug} LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("Learning content get:", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, slug: rawOldSlug } = await params;
    const oldSlug = decodeSlug(rawOldSlug);
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const body = await req.json();
    const { slug, title, content, jlpt_level, tags, status, sort_order, meta, override_review_gate, sidecar } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const statusVal = status === "published" ? "published" : "draft";

    if (statusVal === "published" && !override_review_gate) {
      const existingRows = await sql`SELECT id FROM posts WHERE content_type = ${type} AND slug = ${oldSlug} LIMIT 1`;
      const postId = (existingRows[0] as { id: string } | undefined)?.id;
      if (postId) {
        const [gate, blockGate] = await Promise.all([
          getPublishGateStatus(postId),
          getContentBlockPublishGateStatus(postId, type),
        ]);
        const allReasons = [...gate.reasons, ...blockGate.reasons];
        if (gate.blocked || blockGate.blocked) {
          return NextResponse.json(
            { error: `Publish blocked: ${allReasons.join("; ")}.`, reasons: allReasons, findings: gate.openCriticalFindings },
            { status: 409 }
          );
        }
      }
    }
    const sortOrderVal = typeof sort_order === "number" ? sort_order : 0;
    const metaVal =
      meta != null && typeof meta === "object" && !Array.isArray(meta)
        ? JSON.stringify(meta)
        : "{}";
    const contentVal = content !== undefined && content !== null ? String(content) : null;
    const jlptArr = jlpt_level != null && String(jlpt_level).trim() ? [String(jlpt_level).trim()] : [];
    const publishedAtVal = statusVal === "published" ? new Date().toISOString() : null;

    try {
      const updatedRows = await sql`
        UPDATE posts SET
          slug = ${String(slug).trim()},
          title = ${String(title).trim()},
          content = ${contentVal},
          jlpt_level = ${jlptArr},
          tags = ${Array.isArray(tags) ? tags : []},
          meta = ${metaVal}::jsonb,
          status = ${statusVal},
          sort_order = ${sortOrderVal},
          published_at = ${publishedAtVal},
          updated_at = ${new Date().toISOString()}
        WHERE content_type = ${type} AND slug = ${oldSlug}
        RETURNING id, content_type, title, jlpt_level, meta
      ` as { id: string; content_type: string; title: string; jlpt_level: string[] | null; meta: unknown }[];

      const updated = updatedRows[0];
      if (updated) {
        // Sync from meta first (covers types without a dedicated editor yet),
        // then apply explicit sidecar fields from a dedicated editor — these
        // take precedence since they're the authoritative source once a type
        // has one (unlike meta, which is heuristically parsed).
        await syncPostToTypeTable(updated);
        if (sidecar && typeof sidecar === "object" && !Array.isArray(sidecar)) {
          await applySidecarOverrides(type, updated.id, sidecar as Record<string, unknown>);
        }
        if (isReviewEntityType(updated.content_type)) {
          await queueReReviewOnEdit(updated.content_type, updated.id);
        }
      }

      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Learning content update:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, slug: rawSlug } = await params;
    const slug = decodeSlug(rawSlug);
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const result = await sql`
      DELETE FROM posts
      WHERE content_type = ${type} AND slug = ${slug}
      RETURNING id
    `;
    if (!result?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Learning content delete:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
