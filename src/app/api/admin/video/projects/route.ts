import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { resolveScope } from "@/lib/video/scopeResolver";
import { MAX_SPLIT_ITEMS, childTitle, splitSnapshot } from "@/lib/video/splitScope";
import { templateById } from "@/lib/video/templates";
import { randomUUID } from "crypto";
import { createProject, listProjects, logEvent } from "@/lib/video/projects";
import { isKnownVoice } from "@/lib/video/voices";
import {
  NARRATION_LANGS,
  VIDEO_FORMATS,
  type NarrationLang,
  type PacingConfig,
  type ScopeKind,
  type ScopeRef,
  type VideoFormat,
  type VoiceConfig,
} from "@/lib/video/types";

function clamp(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}

/** Keeps only recognised fields, within ranges the pacing engine can actually work to. */
function sanitisePacing(raw: unknown): PacingConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const out: Partial<PacingConfig> = {};
  const spi = clamp(p.secondsPerItem, 5, 300);
  if (spi !== undefined) out.secondsPerItem = spi;
  const repeat = clamp(p.repeatJapanese, 1, 3);
  if (repeat !== undefined) out.repeatJapanese = Math.round(repeat) as 1 | 2 | 3;
  const pause = clamp(p.pauseAfterJapaneseSeconds, 0, 6);
  if (pause !== undefined) out.pauseAfterJapaneseSeconds = pause;
  const pad = clamp(p.scenePaddingSeconds, 0, 3);
  if (pad !== undefined) out.scenePaddingSeconds = pad;
  const ja = clamp(p.japaneseRate, 0.5, 1.5);
  if (ja !== undefined) out.japaneseRate = ja;
  const nar = clamp(p.narrationRate, 0.5, 1.5);
  if (nar !== undefined) out.narrationRate = nar;
  return Object.keys(out).length > 0 ? (out as PacingConfig) : null;
}

/** Only catalogue voices, so a stored project can never reference a voice name Google will
 * reject halfway through a render. */
function sanitiseVoices(raw: unknown): VoiceConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const out: VoiceConfig = {};
  for (const lang of NARRATION_LANGS) {
    const name = v[lang];
    if (typeof name === "string" && isKnownVoice(lang, name)) out[lang] = name;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const SCOPE_KINDS: ScopeKind[] = [
  "curriculum_level", "curriculum_module", "curriculum_submodule", "curriculum_lesson",
  "content_batch", "content_item", "topic",
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
  // "Make N Shorts": one vertical Short per item, in one action.
  //
  // This is not a new pipeline — splitSnapshot() already turns a scope into N per-item scopes for
  // `video_per_item`. What `bulkShorts` adds is pinning the output to vertical ONLY, which is what
  // makes stylePresetForFormats() derive `shorts` for every child. Requesting a landscape cut
  // alongside would silently drop all of them back to lesson pacing, so the flag overrides rather
  // than merges with whatever formats were posted.
  const bulkShorts = body?.bulkShorts === true;

  // The format template, validated against the registry rather than trusted: an unknown id stored
  // here would be read back by generation, resolve to null, and silently produce generic pacing.
  const templateId = typeof body?.templateId === "string" && templateById(body.templateId) ? body.templateId : null;
  const formats = (Array.isArray(body?.formats) ? body.formats : ["vertical"]).filter((f: string) =>
    VIDEO_FORMATS.includes(f as VideoFormat)
  ) as VideoFormat[];
  const narrationLangs = (Array.isArray(body?.narrationLangs) ? body.narrationLangs : ["en"]).filter((l: string) =>
    NARRATION_LANGS.includes(l as NarrationLang)
  ) as NarrationLang[];

  if (bulkShorts) {
    formats.length = 0;
    formats.push("vertical");
  }
  if (formats.length === 0) return NextResponse.json({ error: "At least one output format is required" }, { status: 400 });
  if (narrationLangs.length === 0) return NextResponse.json({ error: "At least one narration language is required" }, { status: 400 });

  // Resolve the scope before inserting anything: a project pointing at zero published items is
  // a dead row that will only fail later at generation time, with a worse error message.
  let snapshot: Awaited<ReturnType<typeof resolveScope>>;
  try {
    snapshot = await resolveScope(scopeKind, scopeRef);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve scope" }, { status: 400 });
  }
  const resolvedTitle = snapshot.title;

  const typedTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const grouping = body?.grouping === "video_per_item" ? "video_per_item" : "single_video";


  // ---- one video per item: N sibling projects sharing a batch id --------------
  //
  // This grouping did nothing before. It reported `items.length` planned videos and then wrote a
  // single project, so it produced one video covering everything — identical to single_video
  // apart from the promise.
  if (grouping === "video_per_item" || bulkShorts) {
    const { children, problems } = splitSnapshot(snapshot);

    if (children.length === 0) {
      return NextResponse.json(
        { error: `Nothing in this scope can be split into its own video. ${problems[0]?.reason ?? ""}`.trim() },
        { status: 400 }
      );
    }
    // Refused rather than queued: renders are serialised and run at ~1.4x realtime, so a large
    // batch would occupy CI for hours before anyone noticed.
    if (children.length > MAX_SPLIT_ITEMS) {
      return NextResponse.json(
        {
          error:
            `${children.length} items is too many to split. The limit is ${MAX_SPLIT_ITEMS}, because each ` +
            `becomes its own render and renders run one at a time. Narrow the batch, or use one video ` +
            `covering everything.`,
          itemCount: children.length,
          maxItems: MAX_SPLIT_ITEMS,
        },
        { status: 413 }
      );
    }

    const batchId = randomUUID();
    const created = [];
    for (const child of children) {
      const project = await createProject({
        title: childTitle(typedTitle || resolvedTitle, child),
        scopeKind: child.scopeKind,
        scopeRef: child.scopeRef,
        // Each child covers exactly one item, so it is a single_video by construction. Storing
        // video_per_item on the child would claim it splits again.
        grouping: "single_video",
        batchId,
        themeKey: typeof body?.themeKey === "string" && body.themeKey ? body.themeKey : "washi-light",
        bgmTrackId: typeof body?.bgmTrackId === "string" ? body.bgmTrackId : null,
        narrationLangs,
        formats,
        targetDurationSeconds: typeof body?.targetDurationSeconds === "number" ? body.targetDurationSeconds : null,
        tone: typeof body?.tone === "string" ? body.tone : null,
        includeBroll: body?.includeBroll === true,
        templateId,
        // One item per child, so a split child is always a Short when vertical-only.
        itemCount: 1,
        pacing: sanitisePacing(body?.pacing),
        voices: sanitiseVoices(body?.voices),
        createdBy: admin.email,
      });
      created.push(project);
    }

    await logEvent({
      projectId: created[0].id,
      actor: admin.email,
      eventType: "batch_created",
      payload: { batchId, count: created.length, scopeKind, skipped: problems.length },
    });

    return NextResponse.json({
      batchId,
      // Children are queued one at a time by the existing GitHub Actions worker — renders are
      // serialised, so this is a queue rather than a fan-out.
      mode: bulkShorts ? "bulk_shorts" : "video_per_item",
      projects: created,
      // The first project, so the existing client redirect keeps working unchanged.
      project: created[0],
      skipped: problems,
      message:
        `Created ${created.length} project${created.length === 1 ? "" : "s"}` +
        (problems.length > 0 ? `, skipped ${problems.length} that cannot stand alone` : "") +
        ". Generate the scripts from the batch view.",
    });
  }

  const project = await createProject({
    // The scope's own title, undecorated.
    //
    // This used to append "· 10 items · 17 Aug" so two same-scope projects could be told apart in
    // a list. That backfired: briefForRender() takes a brief's title from project_title and
    // derives its UTM campaign slug from it, so real brief titles read "Number in Japanese · 40
    // items · 17 Aug", that string became the default thumbnail headline, and campaign slugs
    // carried a date. The Videos count and timestamp now shown in the projects list and on the
    // dashboard distinguish duplicates better and leak nowhere.
    title: typedTitle || resolvedTitle,
    scopeKind,
    scopeRef,
    grouping,
    themeKey: typeof body?.themeKey === "string" && body.themeKey ? body.themeKey : "washi-light",
    bgmTrackId: typeof body?.bgmTrackId === "string" ? body.bgmTrackId : null,
    narrationLangs,
    formats,
    targetDurationSeconds: typeof body?.targetDurationSeconds === "number" ? body.targetDurationSeconds : null,
    tone: typeof body?.tone === "string" ? body.tone : null,
    includeBroll: body?.includeBroll === true,
    // Validated rather than trusted: these come straight from the wizard, and a nonsense
    // secondsPerItem would produce a word budget the model cannot work to. Out-of-range values
    // are clamped rather than rejected, since the generator falls back to per-content-type
    // defaults for anything absent.
    templateId,
    // Vertical-only is only a Short when it covers few items — ten reading passages in a vertical
    // frame is a long video, and calling it a Short generated it with beat splits and word captions.
    itemCount: snapshot.items.length,
    pacing: sanitisePacing(body?.pacing),
    voices: sanitiseVoices(body?.voices),
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
