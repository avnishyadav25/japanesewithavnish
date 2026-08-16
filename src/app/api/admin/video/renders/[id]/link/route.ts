import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent } from "@/lib/video/projects";

interface SnapshotItem {
  postId?: string;
  slug?: string;
  title?: string;
  kind?: string;
}

interface RenderRow {
  id: string;
  project_id: string;
  approval_status: string;
  is_current: boolean;
  doc: { scenes?: { sourceRef?: { kind: string; id: string } }[] };
  content_snapshot: { items?: SnapshotItem[] } | null;
}

async function loadRender(id: string): Promise<RenderRow | null> {
  const rows = (await sql!`
    SELECT r.id, r.project_id, r.approval_status, r.is_current, s.doc, s.content_snapshot
    FROM video_renders r
    JOIN video_storyboards s ON s.id = r.storyboard_id
    WHERE r.id = ${id}::uuid
  `) as RenderRow[];
  return rows[0] ?? null;
}

/**
 * Every content page this render could legitimately sit on.
 *
 * Taken from the storyboard's content snapshot rather than from scene `sourceRef`s: the snapshot
 * is the list of things the video actually teaches, while sourceRefs are per-scene and miss any
 * item whose scenes carry no ref. Chrome scenes (intro, outro, mascot) have no postId and drop out
 * naturally.
 */
function targetsOf(render: RenderRow): { postId: string; title: string; slug?: string; kind?: string }[] {
  const items = render.content_snapshot?.items ?? [];
  const seen = new Set<string>();
  const targets: { postId: string; title: string; slug?: string; kind?: string }[] = [];

  for (const item of items) {
    if (!item.postId || seen.has(item.postId)) continue;
    seen.add(item.postId);
    targets.push({ postId: item.postId, title: item.title ?? item.slug ?? item.postId, slug: item.slug, kind: item.kind });
  }

  // Fall back to scene provenance for storyboards written before content_snapshot was populated.
  if (targets.length === 0) {
    for (const scene of render.doc?.scenes ?? []) {
      const ref = scene.sourceRef;
      if (ref?.kind !== "post" || seen.has(ref.id)) continue;
      seen.add(ref.id);
      targets.push({ postId: ref.id, title: ref.id });
    }
  }
  return targets;
}

/**
 * The candidate pages, and which of them this render is already on.
 *
 * Exists because "Publish to site" was unusable for any multi-item video: the POST derived its
 * target from scene provenance, found more than one post, and returned 400 telling you to pass a
 * postId — which no part of the UI could do. A batch video covering ten words has ten legitimate
 * homes, so the answer is to let you choose them rather than to guess one.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const render = await loadRender(id);
  if (!render) return NextResponse.json({ error: "Render not found" }, { status: 404 });

  const targets = targetsOf(render);
  const linkedRows = (await sql`
    SELECT post_id FROM video_content_links WHERE render_id = ${id}::uuid AND post_id IS NOT NULL
  `) as { post_id: string }[];

  return NextResponse.json({ targets, linked: linkedRows.map((r) => r.post_id) });
}

/**
 * Publishes a render onto one or more content pages (or removes it again).
 *
 * The default target is whatever content the storyboard was generated from, so the common case
 * ("put this video on the page it came from") still needs no input at all.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "unlink" ? "unlink" : "link";

  const render = await loadRender(id);
  if (!render) return NextResponse.json({ error: "Render not found" }, { status: 404 });

  if (action === "unlink") {
    // A specific page when given one, otherwise every page — the card offers both.
    if (typeof body?.postId === "string") {
      await sql`DELETE FROM video_content_links WHERE render_id = ${id}::uuid AND post_id = ${body.postId}::uuid`;
    } else {
      await sql`DELETE FROM video_content_links WHERE render_id = ${id}::uuid`;
    }
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

  const lessonId: string | null = typeof body?.lessonId === "string" ? body.lessonId : null;

  let postIds: string[] = [];
  if (Array.isArray(body?.postIds)) postIds = body.postIds.filter((p: unknown): p is string => typeof p === "string");
  else if (typeof body?.postId === "string") postIds = [body.postId];

  if (postIds.length === 0 && !lessonId) {
    const targets = targetsOf(render);
    if (targets.length === 1) {
      postIds = [targets[0].postId];
    } else {
      // The candidate list travels with the error so the card can render a picker straight from
      // the failed response, instead of the admin being told to supply an id by hand.
      return NextResponse.json(
        {
          error:
            targets.length === 0
              ? "This video is not tied to a content page. Pass a postId or lessonId."
              : `This video covers ${targets.length} pages — choose which to publish it on.`,
          targets,
        },
        { status: 400 }
      );
    }
  }

  const placement = typeof body?.placement === "string" ? body.placement : "inline";
  const sortOrder = typeof body?.sortOrder === "number" ? body.sortOrder : 0;

  // ON CONFLICT against the partial unique indexes added in migration 147. Before those, clicking
  // Publish twice embedded the same video on the same page twice, and nothing ever cleaned it up.
  let linked = 0;
  if (lessonId) {
    const rows = (await sql`
      INSERT INTO video_content_links (render_id, lesson_id, placement, sort_order, is_published)
      VALUES (${id}::uuid, ${lessonId}::uuid, ${placement}, ${sortOrder}, true)
      ON CONFLICT (render_id, lesson_id) WHERE lesson_id IS NOT NULL DO NOTHING
      RETURNING id
    `) as { id: string }[];
    linked += rows.length;
  }
  for (const postId of postIds) {
    const rows = (await sql`
      INSERT INTO video_content_links (render_id, post_id, placement, sort_order, is_published)
      VALUES (${id}::uuid, ${postId}::uuid, ${placement}, ${sortOrder}, true)
      ON CONFLICT (render_id, post_id) WHERE post_id IS NOT NULL DO NOTHING
      RETURNING id
    `) as { id: string }[];
    linked += rows.length;
  }

  await logEvent({
    projectId: render.project_id,
    renderId: id,
    actor: admin.email,
    eventType: "render_linked",
    payload: { postIds, lessonId, linked },
  });

  const requested = postIds.length + (lessonId ? 1 : 0);
  const already = requested - linked;
  return NextResponse.json({
    ok: true,
    linked,
    postIds,
    lessonId,
    message:
      linked === 0
        ? "Already published to the site."
        : `Published to ${linked} page${linked === 1 ? "" : "s"}${already > 0 ? ` (${already} already there)` : ""}.`,
  });
}
