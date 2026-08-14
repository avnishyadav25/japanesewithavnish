import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPublishGateStatus } from "@/lib/contentReview/publishGate";
import { queueReReviewOnEdit } from "@/lib/contentReview/contentEditTrigger";
import { isReviewEntityType } from "@/lib/contentReview/types";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug: oldSlug } = await params;
    const body = await req.json();
    const {
      slug,
      title,
      summary,
      content,
      jlpt_level,
      tags,
      status,
      seo_title,
      seo_description,
      og_image_url,
      image_prompt,
      author_name,
      override_review_gate,
      published_at,
    } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const statusVal = status === "published" ? "published" : "draft";
    // Bug fix: this previously ignored the submitted published_at entirely and always reset
    // it to the current save time whenever status was "published" — silently bumping an
    // already-published post's date on every edit, and making the form's "Published at"
    // field non-functional. Now honors whatever was submitted, only defaulting to "now" the
    // first time a post is actually published (no value submitted).
    const publishedAtVal = statusVal === "published" ? published_at || new Date().toISOString() : null;

    if (statusVal === "published" && !override_review_gate) {
      const existingRows = await sql`SELECT id FROM posts WHERE slug = ${oldSlug} LIMIT 1`;
      const postId = (existingRows[0] as { id: string } | undefined)?.id;
      if (postId) {
        const gate = await getPublishGateStatus(postId);
        if (gate.blocked) {
          return NextResponse.json(
            { error: `Publish blocked: ${gate.reasons.join("; ")}.`, reasons: gate.reasons, findings: gate.openCriticalFindings },
            { status: 409 }
          );
        }
      }
    }

    try {
      const updatedRows = await sql`
        UPDATE posts SET
          slug = ${String(slug).trim()},
          title = ${String(title).trim()},
          summary = ${summary ?? null},
          content = ${content ?? null},
          jlpt_level = ${Array.isArray(jlpt_level) ? jlpt_level : []},
          tags = ${Array.isArray(tags) ? tags : []},
          status = ${statusVal},
          published_at = ${publishedAtVal},
          seo_title = ${seo_title ?? null},
          seo_description = ${seo_description ?? null},
          og_image_url = ${og_image_url || null},
          image_prompt = ${image_prompt ?? null},
          author_name = ${author_name || null},
          updated_at = ${new Date().toISOString()}
        WHERE slug = ${oldSlug}
        RETURNING id, content_type
      ` as { id: string; content_type: string }[];

      const updated = updatedRows[0];
      if (updated && isReviewEntityType(updated.content_type)) {
        await queueReReviewOnEdit(updated.content_type, updated.id);
      }

      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Post update:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
