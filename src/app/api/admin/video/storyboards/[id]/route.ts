import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import {
  getStoryboard,
  insertStoryboardVersion,
  logEvent,
  setProjectStatus,
  setStoryboardApproval,
} from "@/lib/video/projects";
import { SCENE_TYPES, type Scene, type SceneType, type Storyboard } from "@/lib/video/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const storyboard = await getStoryboard(id);
  if (!storyboard) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });
  return NextResponse.json({ storyboard });
}

/**
 * Rejects a document that would render into something broken, before it can be saved and
 * queued. Deliberately structural only — it does not police narration wording, which is the
 * editor's business.
 */
function validateDoc(doc: unknown): { ok: true; doc: Storyboard } | { ok: false; error: string } {
  if (!doc || typeof doc !== "object") return { ok: false, error: "Storyboard document must be an object" };
  const candidate = doc as Storyboard;
  if (!Array.isArray(candidate.scenes)) return { ok: false, error: "Storyboard must have a scenes array" };
  if (candidate.scenes.length === 0) return { ok: false, error: "A storyboard needs at least one scene" };

  const seenIds = new Set<string>();
  const scenes = candidate.scenes as Scene[];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.id || typeof scene.id !== "string") return { ok: false, error: `Scene ${i + 1} is missing an id` };
    // Duplicate ids would collide in the TTS cache and make timeline spans ambiguous.
    if (seenIds.has(scene.id)) return { ok: false, error: `Duplicate scene id "${scene.id}"` };
    seenIds.add(scene.id);
    if (!SCENE_TYPES.includes(scene.sceneType as SceneType)) {
      return { ok: false, error: `Scene ${i + 1} has unknown type "${scene.sceneType}"` };
    }
    if (!scene.visual || (scene.visual as { sceneType?: string }).sceneType === undefined) {
      return { ok: false, error: `Scene ${i + 1} is missing its visual spec` };
    }
    if (!Array.isArray(scene.narration)) {
      return { ok: false, error: `Scene ${i + 1} narration must be an array` };
    }
    const segmentIds = new Set<string>();
    for (const segment of scene.narration) {
      if (!segment.id) return { ok: false, error: `A narration segment in scene ${i + 1} is missing an id` };
      if (segmentIds.has(segment.id)) {
        return { ok: false, error: `Duplicate narration segment id "${segment.id}" in scene ${i + 1}` };
      }
      segmentIds.add(segment.id);
    }
  }
  return { ok: true, doc: candidate };
}

/**
 * Saving an edit writes a NEW version rather than mutating the row. That is what makes editing
 * non-destructive: the storyboard that produced an already-published video is never altered,
 * and the previous MP4 stays valid in R2 until a new render supersedes it.
 *
 * Any edit also drops narration audio for segments whose text changed, so the worker
 * re-synthesises exactly those and re-uses the cache for everything else.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const existing = await getStoryboard(id);
  if (!existing) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const validated = validateDoc(body?.doc);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  // Index the previous text by segment id so unchanged narration keeps its audio (and its
  // measured duration) instead of being re-synthesised at cost.
  const previousText = new Map<string, string>();
  for (const scene of existing.doc.scenes) {
    for (const segment of scene.narration) previousText.set(segment.id, segment.text);
  }

  const nextDoc: Storyboard = {
    ...validated.doc,
    projectId: existing.projectId,
    schemaVersion: 1,
    // The timeline is derived from audio; any text edit invalidates it. The worker rebuilds it.
    resolved: undefined,
    scenes: validated.doc.scenes.map((scene) => ({
      ...scene,
      narration: scene.narration.map((segment) => {
        const unchanged = previousText.get(segment.id) === segment.text;
        return unchanged ? segment : { ...segment, ssml: undefined, audio: undefined };
      }),
    })),
  };

  const created = await insertStoryboardVersion({
    projectId: existing.projectId,
    narrationLang: existing.narrationLang,
    source: "human_edited",
    doc: nextDoc,
    parentStoryboardId: existing.id,
    // A human-edited script is approved by definition — the human just read every word of it.
    approvalStatus: "approved",
    createdBy: admin.email,
  });
  await setStoryboardApproval(created.id, "approved", admin.email);
  await setProjectStatus(existing.projectId, "script_ready");
  await logEvent({
    projectId: existing.projectId,
    storyboardId: created.id,
    actor: admin.email,
    eventType: "script_edited",
    payload: { fromVersion: existing.version, toVersion: created.version },
  });

  return NextResponse.json({ storyboard: created });
}
