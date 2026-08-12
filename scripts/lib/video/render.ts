/**
 * Remotion bundling + rendering for the worker.
 *
 * The webpack bundle is built once per process and reused for every job. Bundling takes ~14s
 * cold; doing it per job would dominate the runtime of a 60-second short and would waste most
 * of a GitHub Actions runner's minutes.
 */
import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../../../remotion/webpackOverride";
import { FORMAT_SPECS, type Storyboard, type VideoFormat, type VideoThemeTokens } from "../../../src/lib/video/types";

const COMPOSITION_IDS: Record<VideoFormat, string> = {
  vertical: "Video-Vertical",
  landscape: "Video-Landscape",
  square: "Video-Square",
  embed: "Video-Embed",
};

let bundlePromise: Promise<string> | null = null;

export function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: path.resolve(process.cwd(), "remotion/index.ts"),
      webpackOverride,
      // Remotion serves this as the static file root; it is the same public/ Next uses, so
      // staticFile() paths resolve identically in the Studio and in a worker render.
      publicDir: path.resolve(process.cwd(), "public"),
    });
  }
  return bundlePromise;
}

export interface RenderResult {
  videoPath: string;
  posterPath: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  fileSizeBytes: number;
  renderSeconds: number;
}

export interface RenderOptions {
  storyboard: Storyboard;
  format: VideoFormat;
  themeTokens?: Partial<VideoThemeTokens> | null;
  bgmUrl?: string | null;
  outDir: string;
  /** 0..1, called as frames complete. */
  onProgress?: (progress: number) => void;
  /** Remotion's default is (cores - 1); CI runners are small enough that oversubscribing
   * causes Chrome tabs to thrash. */
  concurrency?: number;
}

export async function renderStoryboard(options: RenderOptions): Promise<RenderResult> {
  const startedAt = Date.now();
  const spec = FORMAT_SPECS[options.format];
  const serveUrl = await getBundle();

  const inputProps = {
    storyboard: options.storyboard,
    layout: spec.layout,
    themeTokens: options.themeTokens ?? null,
    bgmUrl: options.bgmUrl ?? null,
    preview: false,
  };

  // selectComposition runs calculateMetadata in a real browser, so the duration used here is
  // exactly the one the storyboard's resolved timeline declares — no second source of truth.
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_IDS[options.format],
    inputProps,
  });

  await fs.mkdir(options.outDir, { recursive: true });
  const videoPath = path.join(options.outDir, `${options.format}.mp4`);
  const posterPath = path.join(options.outDir, `${options.format}-poster.jpg`);

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: videoPath,
    inputProps,
    pixelFormat: "yuv420p",
    // JPEG frames render measurably faster than PNG and the difference is invisible after
    // H.264 encoding; PNG only matters when the output needs an alpha channel.
    imageFormat: "jpeg",
    jpegQuality: 92,
    crf: 20,
    audioCodec: "aac",
    concurrency: options.concurrency,
    onProgress: options.onProgress ? ({ progress }) => options.onProgress!(progress) : undefined,
  });

  // Poster frame from ~15% in — frame 0 is usually mid-fade-in and reads as a blank card.
  await renderStill({
    composition,
    serveUrl,
    output: posterPath,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 90,
    frame: Math.floor(composition.durationInFrames * 0.15),
  });

  const stat = await fs.stat(videoPath);
  return {
    videoPath,
    posterPath,
    durationSeconds: composition.durationInFrames / composition.fps,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    fileSizeBytes: stat.size,
    renderSeconds: (Date.now() - startedAt) / 1000,
  };
}

export async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

/** Thin ffmpeg wrapper, lifted from the pattern in src/app/api/ai/create-reel-video/route.ts.
 * Only used for post-processing steps Remotion doesn't cover (BGM sidechain ducking, bundle
 * assembly); the main encode is Remotion's. */
export function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) =>
      reject(new Error(`ffmpeg could not be spawned (${err.message}). Install it with "brew install ffmpeg" or apt-get install ffmpeg.`))
    );
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`))));
  });
}
