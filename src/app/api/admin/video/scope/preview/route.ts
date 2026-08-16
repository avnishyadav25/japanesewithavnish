import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { plannedVideoCount, resolveScope } from "@/lib/video/scopeResolver";
import {
  defaultPacingFor,
  estimateStoryboardDuration,
  formatDuration,
  resolvePacing,
  secondsForWords,
  ttsPricePerMillion,
} from "@/lib/video/pacing";
import { buildGenerationRequest } from "@/lib/video/storyboard";
import { DEFAULT_VOICES } from "@/lib/video/tts";
import type { PacingConfig, ScopeKind, ScopeRef, VideoFormat } from "@/lib/video/types";

/**
 * Resolves a scope and prices it, without creating anything.
 *
 * The wizard's estimate panel lives on this. The point is that nothing should be queueable
 * without first knowing how long it will be and what it will cost — "one video per item" over an
 * unfiltered content type is thousands of renders, and that number has to be visible at the
 * moment of decision rather than discovered afterwards.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const scopeKind = body?.scopeKind as ScopeKind | undefined;
  const scopeRef = (body?.scopeRef ?? {}) as ScopeRef;
  const grouping = body?.grouping === "video_per_item" ? "video_per_item" : "single_video";
  const formats = (Array.isArray(body?.formats) ? body.formats : ["vertical"]) as VideoFormat[];
  const langs = Array.isArray(body?.narrationLangs) ? body.narrationLangs : ["en"];

  if (!scopeKind) return NextResponse.json({ error: "scopeKind is required" }, { status: 400 });

  try {
    const snapshot = await resolveScope(scopeKind, scopeRef);
    const kind = snapshot.items[0]?.kind;
    const pacing = resolvePacing((body?.pacing as Partial<PacingConfig> | undefined) ?? null, kind);

    const videos = plannedVideoCount(snapshot, grouping);
    const renders = videos * Math.max(1, formats.length) * Math.max(1, langs.length);

    /**
     * Estimate from the REAL skeleton, not from a formula.
     *
     * buildGenerationRequest costs nothing (no LLM call) and produces the exact scenes and slot
     * budgets the generator would use, so the number here is the same one the generator is
     * working to. An earlier version extrapolated from a dummy Japanese phrase and reported a
     * 20s floor for vocabulary that actually fits in 16 — a warning that fires when nothing is
     * wrong just teaches people to ignore warnings.
     */
    const perVideoSnapshot =
      grouping === "single_video" ? snapshot : { ...snapshot, items: snapshot.items.slice(0, 1) };
    const { request, skeleton } = await buildGenerationRequest(perVideoSnapshot, {
      projectId: "preview",
      narrationLang: (langs[0] ?? "en") as "en" | "hi" | "ja",
      themeKey: "washi-light",
      pacing,
    });
    const planned = new Map(
      request.slots.map((slot) => [slot.id, secondsForWords(slot.maxWords, "en", pacing.narrationRate)])
    );
    const detail = estimateStoryboardDuration(skeleton.scenes, pacing, planned);
    const perVideoSeconds = detail.totalSeconds;
    const itemsInVideo = Math.max(1, perVideoSnapshot.items.length);
    const achievedPerItem = perVideoSeconds / itemsInVideo;

    // Rough character volume, from the same measured speech rates the generator budgets against.
    const voices = { ...DEFAULT_VOICES, ...((body?.voices as Record<string, string>) ?? {}) };
    const totalSpeechSeconds = perVideoSeconds * videos * Math.max(1, langs.length);
    const approxChars = totalSpeechSeconds * 11; // blended EN+JA rate across a typical video
    const ttsCostUsd = (approxChars / 1_000_000) * ttsPricePerMillion(voices.en ?? "Neural2");

    // A 1080p vertical render runs at roughly 3x realtime on a laptop; CI is comparable.
    const renderMinutes = Math.ceil((perVideoSeconds * renders * 3) / 60);


    return NextResponse.json({
      title: snapshot.title,
      jlptLevel: snapshot.jlptLevel ?? null,
      contentKind: kind ?? null,
      itemCount: snapshot.items.length,
      plannedVideos: videos,
      plannedRenders: renders,
      pacing,
      defaultPacing: defaultPacingFor(kind),
      // What this configuration actually achieves per item, measured off the real skeleton.
      achievedSecondsPerItem: Math.round(achievedPerItem),
      sceneCount: skeleton.scenes.length,
      estimate: {
        perVideoSeconds,
        perVideoReadable: formatDuration(perVideoSeconds),
        totalSeconds: perVideoSeconds * renders,
        ttsCostUsd,
        renderMinutes,
        breakdown: {
          japaneseSeconds: Math.round(detail.japaneseSeconds),
          narrationSeconds: Math.round(detail.narrationSeconds),
          pauseSeconds: Math.round(detail.pauseSeconds),
        },
      },
      warnings: buildWarnings(snapshot.items, kind, pacing, achievedPerItem, grouping, perVideoSeconds),
      // Was sliced to 25 to keep the payload small, which was fine for a read-only list and is
      // not for a picker — you cannot deselect the 26th item you cannot see. 200 is the wizard's
      // own maximum batch size, so this never truncates a set the wizard can produce.
      items: snapshot.items.slice(0, 200).map((item) => ({
        postId: item.postId ?? null,
        title: item.title,
        kind: item.kind,
        url: item.url ?? null,
        jlptLevel: item.jlptLevel ?? null,
        exampleCount: item.examples.length,
      })),
    });
  } catch (err) {
    // A scope that resolves to nothing is a normal outcome of over-tight filters, not a crash.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve scope" }, { status: 400 });
  }
}

/** Longest single video worth making. Beyond this nothing we publish to will take it, and a
 *  viewer will not either. A whole JLPT level at single_video grouping lands far past it. */
const MAX_SINGLE_VIDEO_SECONDS = 20 * 60;

function buildWarnings(
  items: { examples: unknown[]; data: Record<string, unknown>; kind?: string; children?: unknown[] }[],
  kind: string | undefined,
  pacing: PacingConfig,
  achievedPerItem: number,
  grouping: "single_video" | "video_per_item",
  perVideoSeconds: number
): string[] {
  const warnings: string[] = [];

  // The render-count warning covers "too many videos"; this covers the opposite mistake, which
  // a whole-level scope walks straight into — one video of every lesson in N5.
  if (grouping === "single_video" && perVideoSeconds > MAX_SINGLE_VIDEO_SECONDS) {
    warnings.push(
      `That is one continuous ${formatDuration(perVideoSeconds)} video from ${items.length} items. ` +
        `Nothing you publish to accepts that, and it is not watchable — switch grouping to ` +
        `"a separate video per item", or narrow the scope to a module or a single lesson.`
    );
  }

  // Only complain when the gap is big enough to matter. A few percent over is the intro and
  // outro, which are real content, not a mis-set budget.
  if (achievedPerItem > pacing.secondsPerItem * 1.25) {
    warnings.push(
      `This works out at ~${Math.round(achievedPerItem)}s per item, not ${pacing.secondsPerItem}s — the Japanese audio, ` +
        `${pacing.repeatJapanese} repeat${pacing.repeatJapanese === 1 ? "" : "s"} and the ${pacing.pauseAfterJapaneseSeconds}s pause ` +
        `already fill most of the budget. Raise seconds per item, or cut a repeat or the pause.`
    );
  }

  // A lesson's own blocks are only headings and prose. Everything filmable comes from the
  // curriculum's join tables, and only about half the lessons have anything linked — so a video
  // for one of the others is a narrated slideshow of its section titles. Worth knowing before
  // rendering rather than after watching.
  if (kind === "lesson") {
    const bare = items.filter((i) => (i.children?.length ?? 0) === 0).length;
    if (bare > 0) {
      warnings.push(
        `${bare} of ${items.length} lesson${items.length === 1 ? " has" : "s have"} no vocabulary, kanji or grammar ` +
          `linked in the curriculum, so ${items.length === 1 ? "this video" : "those videos"} will be section titles with ` +
          `narration and nothing else on screen. Link content to the lesson first, or pick a lesson that has some.`
      );
    }
  }

  const noExamples = items.filter((i) => i.examples.length === 0).length;
  if (noExamples > 0) {
    warnings.push(`${noExamples} of ${items.length} items have no example sentences — those scenes are explanation-only.`);
  }

  if (kind === "grammar") {
    const silent = items.filter((i) => i.data.pattern_spoken === "").length;
    if (silent > 0) {
      warnings.push(
        `${silent} patterns are placeholder forms like "A は B です" that cannot be read aloud. ` +
          `Their scenes are narrated in English with the example sentences carrying the Japanese — which is correct, not a fault.`
      );
    }
    const unbackfilled = items.filter(
      (i) => typeof i.data.pattern === "string" && /[A-Za-z]/.test(i.data.pattern) && i.data.pattern_spoken == null
    ).length;
    if (unbackfilled > 0) {
      warnings.push(`${unbackfilled} patterns have no curated spoken form. Run npm run grammar:spoken -- --apply.`);
    }
  }

  if (kind === "kanji") {
    const noStrokes = items.filter(
      (i) => !Array.isArray(i.data.stroke_data) || (i.data.stroke_data as unknown[]).length === 0
    ).length;
    if (noStrokes > 0) warnings.push(`${noStrokes} kanji have no stroke data — those show the plain glyph.`);
  }

  return warnings;
}
