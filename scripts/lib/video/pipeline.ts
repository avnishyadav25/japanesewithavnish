/**
 * The render pipeline: one claimed job, start to finish.
 *
 * Stages are sequential and each one reports progress before it starts, so a job that dies
 * mid-flight leaves behind a row saying which stage it died in rather than a bare "failed".
 *
 *   tts       synthesise narration (cache hits are free)
 *   broll     capture the live site with Playwright (skipped when no scene needs it)
 *   timeline  measured durations -> frame spans + caption cues
 *   render    Remotion -> mp4 + poster
 *   post      captions sidecars
 *   upload    everything to R2
 */
import fs from "fs/promises";
import path from "path";
import { resolveNarrationAudio } from "../../../src/lib/video/tts";
import { buildTimeline, toSrt, toVtt } from "../../../src/lib/video/timeline";
import { uploadToR2 } from "../../../src/lib/r2";
import {
  FORMAT_SPECS,
  type BrollPageVisual,
  type NarrationSegment,
  type Scene,
  type Storyboard,
} from "../../../src/lib/video/types";
import { capture, closeBrowser, type CaptureRecipe } from "./capture";
import {
  appendLog,
  completeJob,
  getProjectMeta,
  isCancelled,
  loadStoryboard,
  logEvent,
  recordRender,
  resolveApprovalMode,
  saveStoryboardDoc,
  setProjectStatus,
  setStage,
  type ClaimedJob,
} from "./db";
import { makeTempDir, renderStoryboard } from "./render";
import { generateSocialForRender } from "../social/autoGenerate";

export interface PipelineOptions {
  runnerLabel: string;
  concurrency?: number;
  /** Skips every DB write and R2 upload; used by `npm run video:render`. */
  dryRun?: boolean;
  outDirOverride?: string;
}

/** Thrown when a job is cancelled mid-flight; the caller treats it as a clean stop, not a failure. */
export class JobCancelled extends Error {
  constructor() {
    super("Job cancelled");
    this.name = "JobCancelled";
  }
}

async function assertNotCancelled(jobId: string, dryRun?: boolean): Promise<void> {
  if (dryRun) return;
  if (await isCancelled(jobId)) throw new JobCancelled();
}

export async function runJob(job: ClaimedJob, options: PipelineOptions): Promise<void> {
  const loaded = await loadStoryboard(job.storyboardId);
  const spec = FORMAT_SPECS[job.format];
  const outDir = options.outDirOverride ?? (await makeTempDir(`video-${job.id.slice(0, 8)}`));
  const log = async (message: string) => {
    console.log(`[video-worker] ${message}`);
    if (!options.dryRun) await appendLog(job.id, message);
  };

  try {
    if (!options.dryRun) await setProjectStatus(job.projectId, "rendering");

    // ---- 1. TTS ------------------------------------------------------------
    await assertNotCancelled(job.id, options.dryRun);
    if (!options.dryRun) await setStage(job.id, "tts", 5);

    let synthesized = 0;
    let ttsCostUsd = 0;
    const scenes = [];
    for (const scene of loaded.doc.scenes) {
      const narration: NarrationSegment[] = await resolveNarrationAudio(scene.narration, {
        // Project overrides the theme. The theme row also carries jaRate/narrationRate keys
        // that are not voice names, so spreading it under the project's picks is safe — only
        // recognised language keys are ever read by voiceForSegment().
        voices: { ...(loaded.themeVoices ?? {}), ...(loaded.projectVoices ?? {}) },
        cache: options.dryRun ? undefined : (await import("./db")).ttsCache,
        onSynthesized: ({ charCount, costUsd }) => {
          synthesized += 1;
          ttsCostUsd += costUsd;
          void charCount;
        },
      });
      scenes.push({ ...scene, narration });
    }
    const cacheHits = loaded.doc.scenes.reduce((n, s) => n + s.narration.length, 0) - synthesized;
    await log(`Narration ready — ${synthesized} synthesised, ${cacheHits} from cache ($${ttsCostUsd.toFixed(4)})`);

    // ---- 2. B-roll ---------------------------------------------------------
    await assertNotCancelled(job.id, options.dryRun);
    const brollScenes = scenes.filter((s) => s.sceneType === "broll_page");
    if (brollScenes.length > 0) {
      if (!options.dryRun) await setStage(job.id, "broll", 15);
      let captured = 0;
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (scene.sceneType !== "broll_page") continue;
        const visual = scene.visual as BrollPageVisual;
        // durationSeconds comes from the SCENE, which is the only place it is authored.
        //
        // It was omitted, so every cached capture recorded duration_seconds = NULL — all six rows
        // in the cache summed to zero. An earlier pass plumbed the value through captureImage and
        // achieved nothing, because nothing upstream ever set it.
        //
        // NOTE it is part of recipeHash, so adding it invalidates the existing cache rows once and
        // they are re-captured on the next render. That is the intended cost.
        //
        // NOTE ALSO that this corrects the recorded data, not the video: a broll_page scene is
        // durationMode "auto" with a narration slot, so its on-screen length comes from the
        // narration, and nothing in the render path reads visual.asset.durationSeconds at all.
        const recipe: CaptureRecipe = {
          url: visual.sourceUrl,
          kind: visual.captureKind,
          viewportWidth: spec.width,
          viewportHeight: spec.height,
          durationSeconds: scene.durationSeconds > 0 ? scene.durationSeconds : undefined,
          contentRef: scene.sourceRef?.kind === "post" ? { postId: scene.sourceRef.id } : undefined,
        };
        try {
          const asset = await capture(recipe);
          scenes[i] = {
            ...scene,
            visual: {
              ...visual,
              asset: {
                url: asset.url,
                kind: asset.kind,
                brollAssetId: asset.id,
                durationSeconds: asset.durationSeconds ?? undefined,
                width: asset.width,
                height: asset.height,
              },
            },
          } as Scene;
          captured += 1;
        } catch (err) {
          // A failed capture must not fail the whole video. The scene renders its labelled
          // "B-roll pending" placeholder, which is visible in the preview and in the output,
          // so the gap is obvious rather than silent.
          await log(`B-roll capture failed for ${visual.sourceUrl}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      await closeBrowser();
      await log(`B-roll: ${captured}/${brollScenes.length} captured`);
    }

    // ---- 3. Timeline -------------------------------------------------------
    await assertNotCancelled(job.id, options.dryRun);
    if (!options.dryRun) await setStage(job.id, "timeline", 20);

    const withAudio: Storyboard = { ...loaded.doc, scenes };
    const timeline = buildTimeline(withAudio, { format: job.format });
    const resolvedDoc: Storyboard = { ...withAudio, resolved: timeline };
    // Persisted so a second format, or a re-run after a crash, reuses the measured audio.
    if (!options.dryRun) await saveStoryboardDoc(job.storyboardId, resolvedDoc);
    await log(
      `Timeline resolved — ${resolvedDoc.scenes.length} scenes, ${(timeline.totalFrames / timeline.fps).toFixed(1)}s, ${timeline.cues.length} caption cues`
    );

    // ---- 4. Render ---------------------------------------------------------
    await assertNotCancelled(job.id, options.dryRun);
    if (!options.dryRun) await setStage(job.id, "render", 25);

    let lastReported = 0;
    const result = await renderStoryboard({
      storyboard: resolvedDoc,
      format: job.format,
      themeTokens: loaded.themeTokens,
      bgmUrl: loaded.bgmUrl,
      captionSettings: loaded.projectCaptions,
      outDir,
      concurrency: options.concurrency,
      onProgress: (progress) => {
        // Render occupies 25-80% of the bar. Throttled to whole percent to avoid a DB write
        // per frame — a 15-minute video is 27,000 frames.
        const pct = 25 + Math.round(progress * 55);
        if (pct > lastReported && !options.dryRun) {
          lastReported = pct;
          void setStage(job.id, "render", pct).catch(() => {});
        }
      },
    });
    await log(
      `Rendered ${spec.width}x${spec.height} in ${result.renderSeconds.toFixed(1)}s (${(result.fileSizeBytes / 1_000_000).toFixed(1)} MB)`
    );

    // ---- 5. Post: caption sidecars ----------------------------------------
    if (!options.dryRun) await setStage(job.id, "post", 82);
    const srtPath = path.join(outDir, `${job.format}.srt`);
    const vttPath = path.join(outDir, `${job.format}.vtt`);
    await fs.writeFile(srtPath, toSrt(timeline), "utf8");
    await fs.writeFile(vttPath, toVtt(timeline), "utf8");

    if (options.dryRun) {
      await log(`Dry run complete — artifacts in ${outDir}`);
      return;
    }

    // ---- 6. Upload ---------------------------------------------------------
    await assertNotCancelled(job.id, options.dryRun);
    await setStage(job.id, "upload", 88);

    const keyBase = `video/renders/${job.projectId}/${job.storyboardId}/${job.format}`;
    const [videoUrl, posterUrl, srtUrl, vttUrl] = await Promise.all([
      uploadToR2(`${keyBase}.mp4`, await fs.readFile(result.videoPath), "video/mp4"),
      uploadToR2(`${keyBase}-poster.jpg`, await fs.readFile(result.posterPath), "image/jpeg"),
      uploadToR2(`${keyBase}.srt`, await fs.readFile(srtPath), "text/plain; charset=utf-8"),
      uploadToR2(`${keyBase}.vtt`, await fs.readFile(vttPath), "text/vtt; charset=utf-8"),
    ]);

    // The approval policy decides whether a human has to watch this before it can go out.
    const meta = await getProjectMeta(job.projectId);
    const mode = await resolveApprovalMode({
      scopeKind: meta.scopeKind,
      contentType: meta.contentType,
      format: job.format,
      publishTargetKind: "site",
    });
    const approvalStatus = mode === "dual_gate" ? "pending_review" : "not_required";

    const renderId = await recordRender({
      jobId: job.id,
      projectId: job.projectId,
      storyboardId: job.storyboardId,
      format: job.format,
      narrationLang: loaded.narrationLang,
      videoUrl,
      posterUrl,
      srtUrl,
      vttUrl,
      durationSeconds: result.durationSeconds,
      width: result.width,
      height: result.height,
      fps: result.fps,
      fileSizeBytes: result.fileSizeBytes,
      renderSeconds: result.renderSeconds,
      approvalStatus,
    });

    await completeJob(job.id);
    await setProjectStatus(job.projectId, approvalStatus === "pending_review" ? "video_pending_review" : "render_ready");
    await logEvent({
      projectId: job.projectId,
      renderJobId: job.id,
      renderId,
      actor: `worker:${options.runnerLabel}`,
      eventType: "render_completed",
      payload: {
        format: job.format,
        durationSeconds: result.durationSeconds,
        renderSeconds: result.renderSeconds,
        ttsCostUsd,
        ttsSynthesized: synthesized,
        ttsCacheHits: cacheHits,
      },
    });
    await log(`Uploaded — ${videoUrl}`);

    // ---- 7. Social copy ----------------------------------------------------
    // Captions for the obvious surfaces, written the moment the video exists, so a finished
    // render is never sitting there un-promotable. Deliberately non-fatal and last: the video is
    // already uploaded and recorded by this point, and a DeepSeek outage must not turn a
    // successful render into a failed job.
    if (!options.dryRun) {
      try {
        await generateSocialForRender({ renderId, actor: `worker:${options.runnerLabel}`, log });
      } catch (err) {
        await log(`Social copy skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    // Renders are hundreds of MB; a worker that leaks temp dirs fills a CI runner's disk
    // within a handful of jobs. Preserved on a dry run, which is the whole point of one.
    if (!options.outDirOverride) await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
