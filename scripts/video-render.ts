/**
 * Local render, no queue and no side effects — the design/debug loop for scene work.
 *
 *   npm run video:render -- --storyboard=<uuid> --format=vertical
 *   npm run video:render -- --storyboard=<uuid> --format=landscape --out=./out
 *
 * Writes the MP4, poster and captions into --out (default ./out/video-<id>) and touches
 * neither the database nor R2, so it is safe to run against production data while iterating
 * on a scene component. TTS still calls Google (it has to, to get real durations) but with
 * caching disabled — pass a storyboard whose narration has already been synthesised once by a
 * real job if you want it to be free.
 */
import "dotenv/config";
import path from "path";
import { runJob } from "./lib/video/pipeline";
import { loadStoryboard } from "./lib/video/db";
import { VIDEO_FORMATS, type VideoFormat } from "../src/lib/video/types";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

async function main(): Promise<void> {
  const storyboardId = arg("storyboard");
  const format = (arg("format") ?? "vertical") as VideoFormat;

  if (!storyboardId) {
    console.error("Usage: npm run video:render -- --storyboard=<uuid> [--format=vertical|landscape|square|embed] [--out=./out]");
    process.exit(1);
  }
  if (!VIDEO_FORMATS.includes(format)) {
    console.error(`Unknown format "${format}". Expected one of: ${VIDEO_FORMATS.join(", ")}`);
    process.exit(1);
  }

  const loaded = await loadStoryboard(storyboardId);
  const outDir = path.resolve(arg("out") ?? `./out/video-${storyboardId.slice(0, 8)}`);

  console.log(`Rendering "${loaded.projectTitle}" (${loaded.narrationLang}) as ${format} -> ${outDir}`);

  await runJob(
    {
      // No queue row exists for a local render; the pipeline only uses these fields for
      // logging and output paths when dryRun is set.
      id: `local-${storyboardId.slice(0, 8)}`,
      projectId: loaded.projectId,
      storyboardId,
      format,
      attemptCount: 1,
      maxAttempts: 1,
    },
    { runnerLabel: "local-dry-run", dryRun: true, outDirOverride: outDir }
  );

  console.log(`\nDone. Open ${path.join(outDir, `${format}.mp4`)}`);
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
