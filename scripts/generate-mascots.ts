/**
 * Generates the mascot cast as transparent PNGs.
 *
 *   npx tsx scripts/generate-mascots.ts                    PILOT — generates, mattes, writes a
 *                                                          contact sheet, commits nothing
 *   npx tsx scripts/generate-mascots.ts --promote          copies the REVIEWED pilot output
 *                                                          into public/mascots/ (no new calls)
 *   npx tsx scripts/generate-mascots.ts --apply            regenerates AND writes public/
 *   npx tsx scripts/generate-mascots.ts --only fox:wave    one cell, for iterating on a prompt
 *   npx tsx scripts/generate-mascots.ts --dry-run          prints prompts, calls nothing
 *
 * Follows the PILOT/APPLY convention from scripts/backfill-grammar-spoken.ts: the default run
 * writes nothing you have to undo.
 *
 * USE --promote, NOT --apply. Image generation is non-deterministic, so `--apply` produces a
 * different cast than the one on the contact sheet you just approved — which makes the review
 * step theatre. `--promote` ships exactly the bytes you looked at. `--apply` exists only for
 * the case where you genuinely want a fresh roll and will review afterwards.
 *
 * WHY A SCRIPT AND NOT THE ADMIN IMAGE ROUTE
 * /api/ai/generate-image force-flattens every result to JPEG via compressGeneratedImage, which
 * destroys the alpha channel these images exist for, and its BASE_STYLE negative-prompts
 * "no anime, no people faces" while baking a URL watermark into the frame. Mascots need the
 * opposite of all three.
 *
 * WHY MATTING IS A SEPARATE STEP
 * Neither Gemini 2.5 Flash Image nor Z-Image reliably emits a real alpha channel from a text
 * prompt. So the character is generated on a flat magenta field (MASCOT_CHROMA) and keyed out
 * here. Chroma keying AI art is genuinely imperfect — soft edges pick up a coloured fringe — so
 * the pilot writes a contact sheet over a checkerboard, which is the background that makes
 * fringing obvious. Look at it before --apply.
 */
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";
import { generateImageWithGemini } from "../src/lib/ai/image-providers/gemini";
import {
  MASCOT_CHARACTERS,
  MASCOT_CHROMA,
  MASCOT_POSES,
  getMascotPrompt,
  type MascotCharacter,
  type MascotPose,
} from "../src/lib/ai/image-prompts";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * The cells actually used by the video: an intro wave, per-scene-type corners, an outro.
 *
 * Kept in step with MascotId in src/lib/video/mascots.ts — a cell here with no id there is art
 * nothing can select, and an id there with no cell here is a broken staticFile() at render time.
 * The `--only` flag exists so a second cast can be generated without re-running the first eight
 * and paying to replace art already approved.
 */
const CAST: { character: MascotCharacter; pose: MascotPose }[] = [
  { character: "fox", pose: "wave" },
  { character: "fox", pose: "point" },
  { character: "fox", pose: "celebrate" },
  { character: "tanuki", pose: "write" },
  { character: "tanuki", pose: "think" },
  { character: "owl", pose: "point" },
  { character: "owl", pose: "think" },
  { character: "redPanda", pose: "wave" },
  { character: "cat", pose: "point" },
  { character: "cat", pose: "bow" },
  { character: "shiba", pose: "celebrate" },
  { character: "shiba", pose: "wave" },
  { character: "crane", pose: "think" },
  { character: "crane", pose: "bow" },
  { character: "rabbit", pose: "read" },
  { character: "rabbit", pose: "wave" },
];

/**
 * How far a pixel may sit from the detected background colour and still be keyed out.
 *
 * Squared Euclidean distance in RGB. Two thresholds give a feathered edge rather than a hard,
 * aliased cut: fully transparent inside KEY, fully opaque outside EDGE, ramped between.
 */
import { checkerboard, matteChroma, type MatteStats } from "./lib/chromaMatte";

function slug(character: MascotCharacter, pose: MascotPose): string {
  return `${character.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}-${pose}`;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const promote = args.includes("--promote");
  const dryRun = args.includes("--dry-run");

  // Promote copies the reviewed pilot output across untouched. No model calls, no re-matting —
  // the whole point is that what ships is what was approved.
  if (promote) {
    const reviewDir = path.resolve("video-brand-preview/mascots");
    const publicDir = path.resolve("public/mascots");
    await fs.mkdir(publicDir, { recursive: true });

    let files: string[];
    try {
      files = (await fs.readdir(reviewDir)).filter((f) => f.endsWith(".png") && !f.endsWith(".raw.png") && !f.startsWith("_"));
    } catch {
      console.error(`Nothing to promote — ${reviewDir} does not exist. Run the pilot first.`);
      process.exit(1);
    }
    if (files.length === 0) {
      console.error(`Nothing to promote — no matted PNGs in ${reviewDir}. Run the pilot first.`);
      process.exit(1);
    }

    for (const file of files) {
      await fs.copyFile(path.join(reviewDir, file), path.join(publicDir, file));
      console.log(`promoted  ${file}`);
    }
    console.log(`\n${files.length} mascot${files.length === 1 ? "" : "s"} now in public/mascots/ — byte-identical to the contact sheet.`);
    process.exit(0);
  }
  const onlyArg = args.find((a) => a.startsWith("--only"))?.split("=")[1] ?? args[args.indexOf("--only") + 1];

  let cast = CAST;
  if (onlyArg && onlyArg.includes(":")) {
    const [c, p] = onlyArg.split(":");
    cast = CAST.filter((x) => x.character === c && x.pose === p);
    if (cast.length === 0) {
      console.error(
        `No cast entry "${onlyArg}". Characters: ${Object.keys(MASCOT_CHARACTERS).join(", ")}. ` +
          `Poses: ${Object.keys(MASCOT_POSES).join(", ")}.`
      );
      process.exit(1);
    }
  }

  console.log(`${apply ? "APPLY" : "PILOT"} — ${cast.length} mascot${cast.length === 1 ? "" : "s"}\n`);

  if (dryRun) {
    for (const { character, pose } of cast) {
      console.log(`--- ${slug(character, pose)} ---\n${getMascotPrompt(character, pose)}\n`);
    }
    process.exit(0);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
    console.error("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is not set — nothing to generate with.");
    process.exit(1);
  }

  const reviewDir = path.resolve("video-brand-preview/mascots");
  const publicDir = path.resolve("public/mascots");
  await fs.mkdir(reviewDir, { recursive: true });
  if (apply) await fs.mkdir(publicDir, { recursive: true });

  const rendered: { name: string; buffer: Buffer }[] = [];
  const failures: string[] = [];

  for (const { character, pose } of cast) {
    const name = slug(character, pose);
    process.stdout.write(`${name.padEnd(22)} `);
    try {
      const raw = await generateImageWithGemini(getMascotPrompt(character, pose));
      const { buffer, stats } = await matteChroma(raw.buffer);

      const share = stats.transparentPixels / stats.totalPixels;
      const bgPct = (share * 100).toFixed(0);
      const edgePct = ((stats.edgePixels / stats.totalPixels) * 100).toFixed(1);
      const { r, g, b, flat } = stats.background;
      const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

      // A plausible cutout is mostly background. Near 0% means the key failed or the model
      // painted a scene; near 100% means it returned an almost-empty frame.
      const notes: string[] = [];
      if (share < 0.25) notes.push("almost nothing was keyed — check the raw image");
      if (share > 0.95) notes.push("almost everything was keyed — the frame may be empty");
      if (!flat) notes.push("background is not flat");

      await fs.writeFile(path.join(reviewDir, `${name}.png`), buffer);
      await fs.writeFile(path.join(reviewDir, `${name}.raw.png`), raw.buffer);
      if (apply) await fs.writeFile(path.join(publicDir, `${name}.png`), buffer);

      rendered.push({ name, buffer });
      console.log(
        `ok  ${(buffer.length / 1024).toFixed(0).padStart(4)}KB  bg ${bgPct.padStart(3)}%  edge ${edgePct.padStart(4)}%  keyed ${hex}` +
          (notes.length ? `   <-- ${notes.join("; ")}` : "")
      );
    } catch (err) {
      failures.push(name);
      console.log(`FAILED  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (rendered.length > 0) {
    const cellSize = 280;
    const cols = Math.min(4, rendered.length);
    const rows = Math.ceil(rendered.length / cols);
    const board = await checkerboard(cellSize);

    const composites = await Promise.all(
      rendered.map(async ({ buffer }, i) => ({
        input: await sharp(board)
          .composite([
            { input: await sharp(buffer).resize({ width: cellSize - 24, height: cellSize - 24, fit: "inside" }).toBuffer(), gravity: "center" },
          ])
          .png()
          .toBuffer(),
        left: (i % cols) * cellSize,
        top: Math.floor(i / cols) * cellSize,
      }))
    );

    const sheetPath = path.join(reviewDir, "_contact-sheet.png");
    await sharp({
      create: { width: cols * cellSize, height: rows * cellSize, channels: 4, background: "#1a1a1a" },
    })
      .composite(composites)
      .png()
      .toFile(sheetPath);

    console.log(`\nContact sheet (checkerboard shows fringing): ${sheetPath}`);
    console.log(`Cell order: ${rendered.map((r) => r.name).join(", ")}`);
  }

  if (failures.length > 0) console.log(`\nFailed: ${failures.join(", ")}`);

  console.log(
    apply
      ? `\nWrote ${rendered.length} PNG${rendered.length === 1 ? "" : "s"} to public/mascots/.`
      : `\nPILOT — nothing was written to public/. Look at the contact sheet, then re-run with --apply.`
  );
  process.exit(failures.length > 0 && rendered.length === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
