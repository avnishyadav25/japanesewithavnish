/**
 * Chroma matting, shared by the mascot cast and the video asset library.
 *
 * EXTRACTED, NOT REWRITTEN. Every line below was lifted verbatim from generate-mascots.ts, where
 * it was developed against real output. The asset library needs exactly the same treatment for
 * exactly the same reason — neither Gemini 2.5 Flash Image nor Z-Image reliably emits a real alpha
 * channel from a text prompt, so a subject is generated on a flat magenta field and keyed out
 * here — and a second, subtly different copy of a flood-fill keyer is how two libraries end up
 * with visibly different edge quality.
 *
 * The despill and partial-alpha rim handling matter more than they look: chroma keying AI art is
 * imperfect, soft edges pick up a coloured fringe, and that fringe is only obvious over a
 * checkerboard — which is why `checkerboard()` lives here too and why both callers write a contact
 * sheet over one before anything is promoted.
 */
import sharp from "sharp";

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

export interface MatteStats {
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
export async function matteChroma(input: Buffer): Promise<{ buffer: Buffer; stats: MatteStats }> {
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
export async function checkerboard(size: number): Promise<Buffer> {
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
