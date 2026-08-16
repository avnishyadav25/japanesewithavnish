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
const KEY_DISTANCE = 60 ** 2;
const EDGE_DISTANCE = 130 ** 2;

/**
 * Reads the actual background colour out of the image corners.
 *
 * The prompt asks for #FF00FF, and the first real generation came back hot pink (#E8138C-ish)
 * instead — close enough for a human to call magenta and far enough that keying on the literal
 * value removed nothing. Image models approximate colour instructions; that is not a bug to
 * prompt around, it is a fact to measure.
 *
 * Corners are sampled rather than the whole frame because the prompt reserves a clear margin,
 * so they are background by construction. Disagreement between them means the background is not
 * flat, which is worth reporting rather than silently keying an average of two colours.
 */
function detectBackground(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): { r: number; g: number; b: number; flat: boolean } {
  const patch = Math.max(4, Math.floor(Math.min(width, height) * 0.03));
  const corners: [number, number][] = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];

  const means = corners.map(([x0, y0]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0; y < y0 + patch; y++) {
      for (let x = x0; x < x0 + patch; x++) {
        const i = (y * width + x) * channels;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
    return [r / n, g / n, b / n] as [number, number, number];
  });

  const avg = means.reduce(
    (acc, m) => [acc[0] + m[0] / 4, acc[1] + m[1] / 4, acc[2] + m[2] / 4] as [number, number, number],
    [0, 0, 0] as [number, number, number]
  );

  // Every corner should be within a hair of the average if the field is genuinely flat.
  const spread = Math.max(
    ...means.map((m) => Math.hypot(m[0] - avg[0], m[1] - avg[1], m[2] - avg[2]))
  );

  return { r: Math.round(avg[0]), g: Math.round(avg[1]), b: Math.round(avg[2]), flat: spread < 24 };
}

/** Output size. Mascots are composited at roughly 200-400px in a 1080-wide frame, so 512 is
 * ample and keeps the committed assets small. */
const OUTPUT_SIZE = 512;

interface MatteStats {
  transparentPixels: number;
  totalPixels: number;
  /** Pixels landing in the feather band. A high count means a soft, hard-to-key edge. */
  edgePixels: number;
  /** The colour actually keyed out, which is rarely the one the prompt asked for. */
  background: { r: number; g: number; b: number; flat: boolean };
}

/**
 * Cuts the character out of its chroma field.
 *
 * FLOOD FILL, NOT A COLOUR KEY. The obvious approach — treat every pixel within some RGB
 * distance of the background as background — cannot work here, and failing at it is instructive:
 * a red fox's fur is (230,120,60) and the field came back at (221,26,132), a distance of 14,101
 * against a 16,900 threshold. Orange and hot pink are neighbours in RGB. A colour key wide
 * enough to catch the background's anti-aliasing also eats the fox.
 *
 * The background has a property the fur does not: it touches the border and is connected to
 * itself. The prompt guarantees a clear margin, so a fill seeded from the edges reaches all of
 * it and none of the character — regardless of what colour the character happens to be. A pink
 * kimono would survive this; it would not survive a colour key.
 *
 * Despill is then applied only to the one-pixel rim where the fill stopped, which is the only
 * place background can have bled into the artwork.
 */
async function matteChroma(input: Buffer): Promise<{ buffer: Buffer; stats: MatteStats }> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const background = detectBackground(data, width, height, channels);
  const { r: cr, g: cg, b: cb } = background;
  // Despill only makes sense against a magenta-family field: it works by pulling red and blue
  // back toward green, which would be exactly wrong for a green or blue background.
  const magentaish = cr > 120 && cb > 60 && cg < Math.min(cr, cb);

  const isBackground = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const near = (px: number) => {
    const i = px * channels;
    const d = (data[i] - cr) ** 2 + (data[i + 1] - cg) ** 2 + (data[i + 2] - cb) ** 2;
    return d <= EDGE_DISTANCE;
  };

  const seed = (px: number) => {
    if (isBackground[px] || !near(px)) return;
    isBackground[px] = 1;
    queue[tail++] = px;
  };

  // Seed from every border pixel. Anything the character touches at the edge simply stays.
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const px = queue[head++];
    const x = px % width;
    const y = (px / width) | 0;
    if (x > 0) seed(px - 1);
    if (x < width - 1) seed(px + 1);
    if (y > 0) seed(px - width);
    if (y < height - 1) seed(px + width);
  }

  let transparentPixels = 0;
  let edgePixels = 0;

  for (let px = 0; px < width * height; px++) {
    const i = px * channels;

    if (isBackground[px]) {
      data[i + 3] = 0;
      transparentPixels += 1;
      continue;
    }

    // Kept pixels touching the fill are the anti-aliased rim: partially background by
    // construction, so they get partial alpha and the despill.
    const x = px % width;
    const y = (px / width) | 0;
    const touchesBackground =
      (x > 0 && isBackground[px - 1]) ||
      (x < width - 1 && isBackground[px + 1]) ||
      (y > 0 && isBackground[px - width]) ||
      (y < height - 1 && isBackground[px + width]);

    if (!touchesBackground) continue;

    edgePixels += 1;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    // The closer the rim pixel is to the field, the more of it was field.
    const t = Math.min(1, Math.max(0, (dist - KEY_DISTANCE) / (EDGE_DISTANCE - KEY_DISTANCE)));
    data[i + 3] = Math.round(data[i + 3] * (0.35 + 0.65 * t));

    if (magentaish) {
      const spill = (r + b) / 2 - g;
      if (spill > 0) {
        const strength = (1 - t) * 0.8;
        data[i] = Math.round(r - spill * strength);
        data[i + 2] = Math.round(b - spill * strength);
      }
    }
  }

  const buffer = await sharp(data, { raw: { width, height, channels } })
    .png()
    // Crops the empty margin the prompt asks for, so every mascot is flush to its own bounding
    // box and can be positioned by its edge rather than by guesswork.
    .trim({ threshold: 0 })
    .resize({ width: OUTPUT_SIZE, height: OUTPUT_SIZE, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer,
    stats: { transparentPixels, totalPixels: width * height, edgePixels, background },
  };
}

/** A checkerboard, because fringing is invisible on white and on black. */
async function checkerboard(size: number): Promise<Buffer> {
  const cell = 16;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#9aa0a6"/>
    ${Array.from({ length: Math.ceil(size / cell) }, (_, y) =>
      Array.from({ length: Math.ceil(size / cell) }, (_, x) =>
        (x + y) % 2 === 0
          ? `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#c8ccd0"/>`
          : ""
      ).join("")
    ).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

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
