import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent } from "@/lib/video/projects";

/**
 * Publishes a render onto its own content page (or removes it again).
 *
 * The default target is whatever content the storyboard was generated from — the scenes carry
 * a `sourceRef` pointing back at the post — so the common case ("put this video on the page it
 * came from") needs no input at all.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "unlink" ? "unlink" : "link";

  const renderRows = (await sql`
    SELECT r.id, r.project_id, r.approval_status, r.is_current, s.doc
    FROM video_renders r
    JOIN video_storyboards s ON s.id = r.storyboard_id
    WHERE r.id = ${id}::uuid
  `) as { id: string; project_id: string; approval_status: string; is_current: boolean; doc: { scenes?: { sourceRef?: { kind: string; id: string } }[] } }[];
  const render = renderRows[0];
  if (!render) return NextResponse.json({ error: "Render not found" }, { status: 404 });

  if (action === "unlink") {
    await sql`DELETE FROM video_content_links WHERE render_id = ${id}::uuid`;
    await logEvent({ projectId: render.project_id, renderId: id, actor: admin.email, eventType: "render_unlinked" });
    return NextResponse.json({ ok: true, message: "Removed from the site." });
  }

  // A dual-gate render that nobody has watched must not go live on a public page.
  if (render.approval_status === "pending_review") {
    return NextResponse.json({ error: "Approve this video before publishing it to the site." }, { status: 409 });
  }
  if (render.approval_status === "rejected") {
    return NextResponse.json({ error: "This video was rejected." }, { status: 409 });
  }
  if (!render.is_current) {
    return NextResponse.json({ error: "This render has been superseded by a newer one." }, { status: 409 });
  }

  let postId: string | null = typeof body?.postId === "string" ? body.postId : null;
  const lessonId: string | null = typeof body?.lessonId === "string" ? body.lessonId : null;

  if (!postId && !lessonId) {
    // Derive the target from the storyboard's own scene provenance.
    const refs = (render.doc?.scenes ?? [])
      .map((s) => s.sourceRef)
      .filter((ref): ref is { kind: string; id: string } => ref?.kind === "post");
    const unique = Array.from(new Set(refs.map((r) => r.id)));
    if (unique.length === 1) postId = unique[0];
    else {
      return NextResponse.json(
        {
          error:
            unique.length === 0
              ? "This video is not tied to a single content page. Pass a postId or lessonId."
              : `This video covers ${unique.length} pages. Pass the postId you want it on.`,
        },
        { status: 400 }
      );
    }
  }

  const rows = (await sql`
    INSERT INTO video_content_links (render_id, post_id, lesson_id, placement, sort_order, is_published)
    VALUES (${id}::uuid, ${postId}, ${lessonId},
            ${typeof body?.placement === "string" ? body.placement : "inline"},
            ${typeof body?.sortOrder === "number" ? body.sortOrder : 0}, true)
    RETURNING id
  `) as { id: string }[];

  await logEvent({
    projectId: render.project_id,
    renderId: id,
    actor: admin.email,
    eventType: "render_linked",
    payload: { postId, lessonId, linkId: rows[0].id },
  });

  return NextResponse.json({ ok: true, linkId: rows[0].id, postId, lessonId, message: "Published to the site." });
}
