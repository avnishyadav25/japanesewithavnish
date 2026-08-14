import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { deleteFromR2, r2KeyFromUrl } from "@/lib/r2";
import { getProject } from "@/lib/video/projects";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

/**
 * Deletes a project and everything under it.
 *
 * The database cascades storyboards, jobs, renders, events and audit rows, but R2 does not —
 * so the MP4s, posters and caption files are removed explicitly. Skipping that leaves hundreds
 * of megabytes of orphaned objects that nothing references and nobody will ever find again.
 *
 * Two things block a delete rather than proceeding quietly:
 *   - a render published to a content page, which would 404 the embed on a live page
 *   - a job currently in flight, which would have a worker writing to rows that no longer exist
 * Both are reported with what to do instead. `?force=true` overrides the published check for
 * the case where removing the video from the site IS the intent.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "true";

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [published, inFlight] = (await Promise.all([
    sql`
      SELECT COUNT(*)::int AS n
      FROM video_content_links l
      JOIN video_renders r ON r.id = l.render_id
      WHERE r.project_id = ${id}::uuid AND l.is_published
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM video_render_jobs
      WHERE project_id = ${id}::uuid AND status IN ('claimed', 'running')
    `,
  ])) as { n: number }[][];

  if ((inFlight[0]?.n ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "A render is in progress. Cancel it at /admin/video/jobs and wait for the worker to stop, then delete.",
      },
      { status: 409 }
    );
  }

  if ((published[0]?.n ?? 0) > 0 && !force) {
    return NextResponse.json(
      {
        error: `${published[0].n} video${published[0].n === 1 ? " is" : "s are"} embedded on live content pages. Deleting removes them from those pages.`,
        requiresForce: true,
        publishedCount: published[0].n,
      },
      { status: 409 }
    );
  }

  // Collect every stored asset before the cascade takes the rows with it.
  const assets = (await sql`
    SELECT video_url, poster_url, srt_url, vtt_url, bundle_url
    FROM video_renders WHERE project_id = ${id}::uuid
  `) as Record<string, string | null>[];

  // Queued jobs are safe to drop, but do it explicitly so a worker that claims one microseconds
  // before the cascade cannot end up mid-render on a deleted project.
  await sql`
    UPDATE video_render_jobs SET status = 'cancelled', completed_at = NOW()
    WHERE project_id = ${id}::uuid AND status = 'queued'
  `;

  await sql`DELETE FROM video_projects WHERE id = ${id}::uuid`;

  // Best effort, and after the row is gone: an orphaned object costs a fraction of a cent, but a
  // failed delete here must not leave a half-removed project behind.
  let removed = 0;
  for (const row of assets) {
    for (const url of Object.values(row)) {
      if (!url) continue;
      const key = r2KeyFromUrl(url);
      if (!key) continue;
      const ok = await deleteFromR2(key).then(() => true).catch(() => false);
      if (ok) removed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Deleted “${project.title}”${removed > 0 ? ` and ${removed} stored file${removed === 1 ? "" : "s"}` : ""}.`,
  });
}
