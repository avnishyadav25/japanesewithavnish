import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent } from "@/lib/video/projects";
import { curriculumTargets, validateLinks, type LinkTarget } from "@/lib/video/curriculumLinks";

interface SnapshotItem {
  postId?: string;
  slug?: string;
  title?: string;
  kind?: string;
  /** Where the curriculum ids live. This type omitted `data` entirely, which is why a lesson-scope
   *  video could never be attached to its lesson: the id was in the snapshot and unreadable. */
  data?: Record<string, unknown>;
}

interface RenderRow {
  id: string;
  project_id: string;
  approval_status: string;
  is_current: boolean;
  doc: { scenes?: { sourceRef?: { kind: string; id: string } }[] };
  content_snapshot: { items?: SnapshotItem[]; jlptLevel?: string } | null;
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
function targetsOf(render: RenderRow): LinkTarget[] {
  const targets = curriculumTargets(render.content_snapshot);
  if (targets.length > 0) return targets;

  // Fall back to scene provenance for storyboards written before content_snapshot was populated.
  const seen = new Set<string>();
  const fallback: LinkTarget[] = [];
  for (const scene of render.doc?.scenes ?? []) {
    const ref = scene.sourceRef;
    if (ref?.kind !== "post" || seen.has(ref.id)) continue;
    seen.add(ref.id);
    fallback.push({ kind: "post", id: ref.id, title: ref.id });
  }
  return fallback;
}

/**
 * The JLPT level of every curriculum target, for the mismatch check.
 *
 * One query per tier rather than per target: a module-scope video can nominate dozens of lessons,
 * and this runs on the click that publishes.
 */
async function levelsForTargets(targets: LinkTarget[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = (kind: LinkTarget["kind"]) => targets.filter((t) => t.kind === kind).map((t) => t.id);

  const lessons = ids("lesson");
  if (lessons.length > 0) {
    const rows = (await sql!.query(
      `SELECT l.id, lv.code FROM curriculum_lessons l
       JOIN curriculum_submodules sm ON sm.id = l.submodule_id
       JOIN curriculum_modules m ON m.id = sm.module_id
       JOIN curriculum_levels lv ON lv.id = m.level_id
       WHERE l.id = ANY($1::uuid[])`, [lessons])) as { id: string; code: string | null }[];
    for (const r of rows) out.set(`lesson:${r.id}`, r.code);
  }
  const submodules = ids("submodule");
  if (submodules.length > 0) {
    const rows = (await sql!.query(
      `SELECT sm.id, lv.code FROM curriculum_submodules sm
       JOIN curriculum_modules m ON m.id = sm.module_id
       JOIN curriculum_levels lv ON lv.id = m.level_id
       WHERE sm.id = ANY($1::uuid[])`, [submodules])) as { id: string; code: string | null }[];
    for (const r of rows) out.set(`submodule:${r.id}`, r.code);
  }
  const modules = ids("module");
  if (modules.length > 0) {
    const rows = (await sql!.query(
      `SELECT m.id, lv.code FROM curriculum_modules m
       JOIN curriculum_levels lv ON lv.id = m.level_id
       WHERE m.id = ANY($1::uuid[])`, [modules])) as { id: string; code: string | null }[];
    for (const r of rows) out.set(`module:${r.id}`, r.code);
  }
  return out;
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
  // Every tier, not just posts. Filtering to post_id here is what made a lesson link invisible to
  // the picker even once one existed.
  const linkedRows = (await sql`
    SELECT post_id, lesson_id, module_id, submodule_id FROM video_content_links
    WHERE render_id = ${id}::uuid
  `) as { post_id: string | null; lesson_id: string | null; module_id: string | null; submodule_id: string | null }[];

  const linked = linkedRows.flatMap((r) =>
    [
      r.post_id && `post:${r.post_id}`,
      r.lesson_id && `lesson:${r.lesson_id}`,
      r.module_id && `module:${r.module_id}`,
      r.submodule_id && `submodule:${r.submodule_id}`,
    ].filter((x): x is string => Boolean(x))
  );

  return NextResponse.json({ targets, linked });
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
    // `kind:id`, matching the link shape. postId is still accepted for the older call shape.
    const one = typeof body?.target === "string" ? body.target : typeof body?.postId === "string" ? `post:${body.postId}` : null;
    if (one) {
      const [kind, tid] = one.split(":");
      const col = (
        { post: "post_id", lesson: "lesson_id", module: "module_id", submodule: "submodule_id" } as Record<string, string | undefined>
      )[kind];
      if (!col) return NextResponse.json({ error: `Unknown target kind "${kind}".` }, { status: 400 });
      await sql.query(`DELETE FROM video_content_links WHERE render_id = $1::uuid AND ${col} = $2::uuid`, [id, tid]);
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

  /**
   * Targets as `kind:id` strings, so one list covers posts and all three curriculum tiers.
   * `postIds` and `lessonId` are still accepted for anything still sending the old shape.
   */
  let chosen: LinkTarget[] = [];
  const all = targetsOf(render);
  const byKey = new Map(all.map((t) => [`${t.kind}:${t.id}`, t]));

  if (Array.isArray(body?.targets)) {
    for (const key of body.targets as unknown[]) {
      if (typeof key !== "string") continue;
      const found = byKey.get(key);
      if (found) chosen.push(found);
      else {
        const [kind, tid] = key.split(":");
        if (["post", "lesson", "module", "submodule"].includes(kind) && tid) {
          chosen.push({ kind: kind as LinkTarget["kind"], id: tid, title: tid });
        }
      }
    }
  }
  if (Array.isArray(body?.postIds)) {
    for (const p of body.postIds) if (typeof p === "string") chosen.push({ kind: "post", id: p, title: p });
  } else if (typeof body?.postId === "string") {
    chosen.push({ kind: "post", id: body.postId, title: body.postId });
  }
  if (typeof body?.lessonId === "string") chosen.push({ kind: "lesson", id: body.lessonId, title: body.lessonId });

  if (chosen.length === 0) {
    if (all.length === 1) {
      chosen = [all[0]];
    } else {
      return NextResponse.json(
        {
          error:
            all.length === 0
              ? "This video is not tied to any content page or lesson."
              : `This video covers ${all.length} places — choose where to publish it.`,
          targets: all,
        },
        { status: 400 }
      );
    }
  }

  /**
   * The relationship check the roadmap asks for, run BEFORE anything is written.
   *
   * `?force=true` exists because a legitimate exception will eventually turn up — a revision video
   * deliberately placed a level down, say — and a check with no override is a check people route
   * around. Overriding is recorded in the event payload.
   */
  const levelByTarget = await levelsForTargets(chosen);
  const issues = validateLinks({
    videoLevel: render.content_snapshot?.jlptLevel ?? null,
    targets: chosen,
    levelByTarget,
  });
  if (issues.length > 0 && body?.force !== true) {
    return NextResponse.json(
      {
        error: issues[0].reason,
        issues,
        hint: "Publish anyway by sending force: true if this placement is deliberate.",
      },
      { status: 409 }
    );
  }

  const placement = typeof body?.placement === "string" ? body.placement : "inline";
  const sortOrder = typeof body?.sortOrder === "number" ? body.sortOrder : 0;

  // One INSERT shape per tier, each against its own partial unique index (migrations 147 and 154).
  // Before those, clicking Publish twice embedded the same video on the same page twice.
  const COLUMN: Record<LinkTarget["kind"], string> = {
    post: "post_id",
    lesson: "lesson_id",
    module: "module_id",
    submodule: "submodule_id",
  };
  let linked = 0;
  for (const target of chosen) {
    const col = COLUMN[target.kind];
    const rows = (await sql.query(
      `INSERT INTO video_content_links (render_id, ${col}, placement, sort_order, is_published)
       VALUES ($1::uuid, $2::uuid, $3, $4, true)
       ON CONFLICT (render_id, ${col}) WHERE ${col} IS NOT NULL DO NOTHING
       RETURNING id`,
      [id, target.id, placement, sortOrder]
    )) as { id: string }[];
    linked += rows.length;
  }

  await logEvent({
    projectId: render.project_id,
    renderId: id,
    actor: admin.email,
    eventType: "render_linked",
    payload: { targets: chosen.map((t) => `${t.kind}:${t.id}`), linked, forced: body?.force === true && issues.length > 0 },
  });

  const requested = chosen.length;
  const already = requested - linked;
  return NextResponse.json({
    ok: true,
    linked,
    targets: chosen.map((t) => `${t.kind}:${t.id}`),
    message:
      linked === 0
        ? "Already published to the site."
        : `Published to ${linked} page${linked === 1 ? "" : "s"}${already > 0 ? ` (${already} already there)` : ""}.`,
  });
}
