import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { resolveScope } from "@/lib/video/scopeResolver";
import { createProject, listProjects, logEvent } from "@/lib/video/projects";
import { NARRATION_LANGS, VIDEO_FORMATS, type NarrationLang, type ScopeKind, type ScopeRef, type VideoFormat } from "@/lib/video/types";

const SCOPE_KINDS: ScopeKind[] = [
  "curriculum_level", "curriculum_module", "curriculum_submodule", "curriculum_lesson",
  "content_batch", "content_item",
];

export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const projects = await listProjects({
    status: url.searchParams.get("status") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 50),
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const scopeKind = body?.scopeKind as ScopeKind | undefined;
  if (!scopeKind || !SCOPE_KINDS.includes(scopeKind)) {
    return NextResponse.json({ error: `scopeKind must be one of: ${SCOPE_KINDS.join(", ")}` }, { status: 400 });
  }

  const scopeRef = (body?.scopeRef ?? {}) as ScopeRef;
  const formats = (Array.isArray(body?.formats) ? body.formats : ["vertical"]).filter((f: string) =>
    VIDEO_FORMATS.includes(f as VideoFormat)
  ) as VideoFormat[];
  const narrationLangs = (Array.isArray(body?.narrationLangs) ? body.narrationLangs : ["en"]).filter((l: string) =>
    NARRATION_LANGS.includes(l as NarrationLang)
  ) as NarrationLang[];

  if (formats.length === 0) return NextResponse.json({ error: "At least one output format is required" }, { status: 400 });
  if (narrationLangs.length === 0) return NextResponse.json({ error: "At least one narration language is required" }, { status: 400 });

  // Resolve the scope before inserting anything: a project pointing at zero published items is
  // a dead row that will only fail later at generation time, with a worse error message.
  let resolvedTitle: string;
  try {
    resolvedTitle = (await resolveScope(scopeKind, scopeRef)).title;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve scope" }, { status: 400 });
  }

  const project = await createProject({
    title: (typeof body?.title === "string" && body.title.trim()) || resolvedTitle,
    scopeKind,
    scopeRef,
    grouping: body?.grouping === "video_per_item" ? "video_per_item" : "single_video",
    themeKey: typeof body?.themeKey === "string" && body.themeKey ? body.themeKey : "washi-light",
    bgmTrackId: typeof body?.bgmTrackId === "string" ? body.bgmTrackId : null,
    narrationLangs,
    formats,
    targetDurationSeconds: typeof body?.targetDurationSeconds === "number" ? body.targetDurationSeconds : null,
    tone: typeof body?.tone === "string" ? body.tone : null,
    includeBroll: body?.includeBroll === true,
    createdBy: admin.email,
  });

  await logEvent({
    projectId: project.id,
    actor: admin.email,
    eventType: "project_created",
    payload: { scopeKind, scopeRef, formats, narrationLangs },
  });

  return NextResponse.json({ project });
}
