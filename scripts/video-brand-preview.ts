/**
 * Renders branding preview stills, so on-screen brand marks can be LOOKED AT rather than assumed.
 *
 *   npx tsx scripts/video-brand-preview.ts [outDir]
 *
 * Branding is the one part of the video pipeline with no meaningful automated assertion. A logo
 * that fails to load, a hashtag that vanishes against a red background, an icon row clipped off
 * the bottom of a 9:16 frame — all typecheck, lint and render without error, and all are only
 * visible in a frame. This renders the frames that are most likely to be wrong:
 *
 *   vertical-mid      logo at opacity, hashtag pill over the light theme
 *   vertical-outro    the full lockup: logo, URL pill, follow row, icons — over PRIMARY RED,
 *                     which is the case a light-coloured hashtag disappears into
 *   landscape-mid     logo present, hashtag ABSENT (16:9 gets no burned-in hashtag)
 *   square-outro      the tightest layout the follow row has to survive
 *
 * Uses SAMPLE_STORYBOARD, so it needs no database and no TTS.
 */
import path from "path";
import fs from "fs/promises";
import { renderStill, selectComposition } from "@remotion/renderer";
import { getBundle } from "./lib/video/render";
import { SAMPLE_STORYBOARD } from "../src/remotion/sampleStoryboard";

type Mark = "mid" | "outro";

const SHOTS: { composition: string; at: Mark; name: string }[] = [
  { composition: "Video-Vertical", at: "mid", name: "vertical-mid" },
  { composition: "Video-Vertical", at: "outro", name: "vertical-outro" },
  { composition: "Video-Landscape", at: "mid", name: "landscape-mid" },
  { composition: "Video-Square", at: "outro", name: "square-outro" },
];

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "video-brand-preview");
  await fs.mkdir(outDir, { recursive: true });

  const serveUrl = await getBundle();
  const inputProps = { storyboard: SAMPLE_STORYBOARD };

  for (const shot of SHOTS) {
    const composition = await selectComposition({ serveUrl, id: shot.composition, inputProps });
    // "outro" targets a frame late enough for the staggered entrances to have finished — the
    // point is to check the finished layout, not to catch it mid-animation.
    const frame =
      shot.at === "outro"
        ? Math.max(0, composition.durationInFrames - 12)
        : Math.round(composition.durationInFrames * 0.45);

    const output = path.join(outDir, `${shot.name}.png`);
    await renderStill({ composition, serveUrl, output, frame, inputProps, imageFormat: "png" });
    console.log(
      `${shot.name.padEnd(16)} frame ${String(frame).padStart(4)}/${composition.durationInFrames}  ` +
        `${composition.width}x${composition.height}  ->  ${output}`
    );
  }

  console.log(`\nOpen them: open ${outDir}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
