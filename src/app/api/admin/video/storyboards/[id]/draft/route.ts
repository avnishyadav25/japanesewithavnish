import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { clearDraft, getDraft, saveDraft } from "@/lib/video/audit";
import { getStoryboard } from "@/lib/video/projects";

/**
 * Autosave slot for the scene/timeline editor.
 *
 * Edits used to live only in browser state, so a refresh or a crashed tab lost them. This is
 * deliberately NOT a storyboard version: an autosave every few seconds would leave dozens of
 * numbered versions behind after one session, and "which of these can I render" would stop
 * having an answer. "Save as new version" remains the explicit act that produces something
 * renderable.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const draft = await getDraft(id, admin.email);
  if (!draft) return NextResponse.json({ draft: null });

  // A draft started against an older version is still restorable, but the editor should say so
  // rather than silently reapplying edits on top of a script that has since been regenerated.
  const storyboard = await getStoryboard(id);
  return NextResponse.json({
    draft,
    stale: Boolean(draft.baseVersion && storyboard && storyboard.version !== draft.baseVersion),
    currentVersion: storyboard?.version ?? null,
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.doc?.scenes) return NextResponse.json({ error: "doc.scenes is required" }, { status: 400 });

  await saveDraft({
    storyboardId: id,
    editorEmail: admin.email,
    doc: body.doc,
    baseVersion: typeof body.baseVersion === "number" ? body.baseVersion : null,
  });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  await clearDraft(id, admin.email);
  return NextResponse.json({ ok: true });
}
