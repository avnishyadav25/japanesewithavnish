/**
 * Generates the reusable video asset library — stickers, characters and textures.
 *
 *   npx tsx scripts/generate-video-assets.ts                 pilot: generates + writes a contact
 *                                                            sheet, uploads nothing
 *   npx tsx scripts/generate-video-assets.ts --promote       uploads the REVIEWED pilot output
 *   npx tsx scripts/generate-video-assets.ts --only=torii-gate,koi-fish
 *   npx tsx scripts/generate-video-assets.ts --category=character
 *
 * USE --promote, NOT a fresh run. Image generation is non-deterministic, so regenerating at upload
 * time would ship a different library than the one on the contact sheet you just approved, and the
 * review step becomes theatre. --promote uploads exactly the bytes you looked at.
 *
 * Matting is shared with the mascot cast (scripts/lib/chromaMatte.ts): the subject is generated on
 * a flat magenta field and keyed out, because neither image model reliably emits a real alpha
 * channel from a text prompt. Textures are the exception — they are meant to fill the frame, so
 * they keep their background and skip the key entirely.
 */
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { generateImageWithGemini } from "../src/lib/ai/image-providers/gemini";
import { uploadToR2 } from "../src/lib/r2";
import { MASCOT_CHROMA } from "../src/lib/ai/image-prompts";
import { ASSET_SPECS, assetPrompt, type AssetSpec } from "../src/lib/video/assets";
import { checkerboard, matteChroma } from "./lib/chromaMatte";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const REVIEW_DIR = path.join(process.cwd(), "reference", "video-assets");
const CELL = 320;

function selection(): AssetSpec[] {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").map((s) => s.trim());
  const category = process.argv.find((a) => a.startsWith("--category="))?.slice(11);
  let specs = ASSET_SPECS;
  if (category) specs = specs.filter((s) => s.category === category);
  if (only?.length) specs = specs.filter((s) => only.includes(s.slug));
  return specs;
}

async function contactSheet(items: { slug: string; buffer: Buffer }[]): Promise<Buffer> {
  const cols = Math.min(6, Math.max(1, items.length));
  const rows = Math.ceil(items.length / cols);
  // Over a checkerboard, because that is the background that makes a chroma fringe obvious. On
  // white it is invisible and ships.
  const tile = await checkerboard(CELL);
  const base = sharp({
    create: { width: cols * CELL, height: rows * CELL, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  });
  const composites: OverlayOptions[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const left = (i % cols) * CELL;
    const top = Math.floor(i / cols) * CELL;
    composites.push({ input: tile, left, top });
    composites.push({
      input: await sharp(items[i].buffer).resize(CELL, CELL, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      left,
      top,
    });
  }
  return base.composite(composites).png().toBuffer();
}

async function promote() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const sql = neon(process.env.DATABASE_URL);

  let files: string[];
  try {
    files = (await fs.readdir(REVIEW_DIR)).filter((f) => f.endsWith(".png") && f !== "contact-sheet.png");
  } catch {
    console.error(`Nothing to promote — ${REVIEW_DIR} does not exist. Run the pilot first.`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`Nothing to promote — no PNGs in ${REVIEW_DIR}. Run the pilot first.`);
    process.exit(1);
  }

  let n = 0;
  for (const file of files) {
    const slug = file.replace(/\.png$/, "");
    const spec = ASSET_SPECS.find((s) => s.slug === slug);
    if (!spec) {
      console.log(`  skipped ${file} — no spec with that slug`);
      continue;
    }
    const buffer = await fs.readFile(path.join(REVIEW_DIR, file));
    const meta = await sharp(buffer).metadata();
    const url = await uploadToR2(`video/assets/${slug}.png`, buffer, "image/png");
    await sql`
      INSERT INTO video_assets (slug, category, label, url, width, height, prompt, tags)
      VALUES (${slug}, ${spec.category}, ${spec.label}, ${url}, ${meta.width ?? null}, ${meta.height ?? null},
              ${assetPrompt(spec)}, ${spec.tags})
      ON CONFLICT (slug) DO UPDATE
        SET url = EXCLUDED.url, width = EXCLUDED.width, height = EXCLUDED.height,
            label = EXCLUDED.label, category = EXCLUDED.category,
            prompt = EXCLUDED.prompt, tags = EXCLUDED.tags
    `;
    console.log(`  promoted ${slug}`);
    n += 1;
  }
  console.log(`\n${n} asset(s) uploaded and registered — byte-identical to the contact sheet.`);
}

async function main() {
  if (process.argv.includes("--promote")) return promote();

  const specs = selection();
  if (specs.length === 0) {
    console.error("Nothing selected. Check --only / --category.");
    process.exit(1);
  }
  await fs.mkdir(REVIEW_DIR, { recursive: true });
  console.log(`Generating ${specs.length} asset(s) into ${REVIEW_DIR}\n`);

  const made: { slug: string; buffer: Buffer }[] = [];
  const failed: string[] = [];

  for (const spec of specs) {
    process.stdout.write(`  ${spec.slug.padEnd(20)} ${spec.category.padEnd(10)}`);
    try {
      const isTexture = spec.category === "texture";
      const prompt = isTexture
        ? assetPrompt(spec)
        // The chroma field is appended rather than written into assets.ts so the prompt module
        // stays free of anything render-pipeline specific and can be read on its own.
        : `${assetPrompt(spec)}\n\nPlace the subject on a completely flat, uniform magenta background (${MASCOT_CHROMA.hex}). The background must be one solid colour with no gradient, texture or shadow.`;

      const result = await generateImageWithGemini(prompt);
      const buffer = isTexture
        ? await sharp(result.buffer).png().toBuffer()
        : (await matteChroma(result.buffer)).buffer;
      await fs.writeFile(path.join(REVIEW_DIR, `${spec.slug}.png`), buffer);
      made.push({ slug: spec.slug, buffer });
      console.log("ok");
    } catch (err) {
      failed.push(spec.slug);
      console.log(`FAILED — ${(err as Error).message.slice(0, 80)}`);
    }
  }

  if (made.length > 0) {
    await fs.writeFile(path.join(REVIEW_DIR, "contact-sheet.png"), await contactSheet(made));
  }

  console.log(`\n${made.length} generated, ${failed.length} failed${failed.length ? `: ${failed.join(", ")}` : ""}.`);
  console.log(`Open ${path.join(REVIEW_DIR, "contact-sheet.png")} and look for coloured fringing on the cut-outs.`);
  console.log("Delete any cell you do not want, then run with --promote. Nothing is uploaded until you do.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
