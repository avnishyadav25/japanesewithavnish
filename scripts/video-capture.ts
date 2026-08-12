/**
 * B-roll capture debug loop.
 *
 *   npm run video:capture -- --url=/learn/vocabulary/neko
 *   npm run video:capture -- --url=/learn/curriculum --kind=scroll_clip --format=landscape
 *   npm run video:capture -- --url=/learn/kana/hiragana --no-cache
 *
 * Eyeball the output before trusting it in a video: no ad slots, no cookie banner, no
 * half-played entrance animation, no missing lazy-loaded image. Uploads to R2 and prints the
 * URL, and writes the DB cache row so a later render reuses it.
 */
import "dotenv/config";
import { capture, closeBrowser, recipeHash, resolveCaptureUrl, type CaptureRecipe } from "./lib/video/capture";
import { sql } from "./lib/video/db";
import { FORMAT_SPECS, VIDEO_FORMATS, type VideoFormat } from "../src/lib/video/types";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

async function main(): Promise<void> {
  const url = arg("url");
  if (!url) {
    console.error(
      "Usage: npm run video:capture -- --url=<path|url> [--kind=still|scroll_clip|interaction_clip] [--format=vertical|landscape|square|embed] [--selector=<css>] [--no-cache]"
    );
    process.exit(1);
  }

  const kind = (arg("kind") ?? "still") as CaptureRecipe["kind"];
  const format = (arg("format") ?? "vertical") as VideoFormat;
  if (!VIDEO_FORMATS.includes(format)) {
    console.error(`Unknown format "${format}". Expected one of: ${VIDEO_FORMATS.join(", ")}`);
    process.exit(1);
  }
  const spec = FORMAT_SPECS[format];

  const recipe: CaptureRecipe = {
    url,
    kind,
    viewportWidth: spec.width,
    viewportHeight: spec.height,
    selector: arg("selector"),
    durationSeconds: arg("duration") ? Number(arg("duration")) : undefined,
  };

  // --no-cache forces a fresh capture, which is what you want while iterating on the
  // ad-hiding CSS — otherwise you keep looking at the first, wrong screenshot.
  if (arg("no-cache") === "true") {
    const hash = recipeHash(recipe);
    await sql`DELETE FROM video_broll_assets WHERE recipe_hash = ${hash}`;
    console.log("Cache entry cleared.");
  }

  console.log(`Capturing ${resolveCaptureUrl(url)} as ${kind} at ${spec.width}x${spec.height} …`);
  const asset = await capture(recipe);
  await closeBrowser();

  console.log("\nDone.");
  console.log(`  url      ${asset.url}`);
  console.log(`  kind     ${asset.kind}`);
  console.log(`  size     ${asset.width}x${asset.height}`);
  if (asset.durationSeconds) console.log(`  duration ${asset.durationSeconds}s`);
  if (asset.kind === "image" && asset.height > asset.width) {
    console.log("\n  Tall capture — the broll_page scene will pan down it rather than crop.");
  }
}

main().catch(async (err) => {
  await closeBrowser();
  console.error("Capture failed:", err);
  process.exit(1);
});
