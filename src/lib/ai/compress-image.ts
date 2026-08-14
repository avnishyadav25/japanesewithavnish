import sharp from "sharp";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 78;

export interface CompressOptions {
  /**
   * Keep the alpha channel and encode PNG instead of JPEG.
   *
   * The JPEG path below flattens transparency to black, which is correct for the illustrated
   * covers this function was written for and fatal for anything meant to sit ON something else.
   * Mascot cutouts are the motivating case: they are composited over video frames, so an image
   * that silently lost its alpha would render as a black rectangle around the character.
   */
  keepAlpha?: boolean;
  /** Overrides MAX_DIMENSION. Mascots are composited small and do not need 1600px. */
  maxDimension?: number;
}

/**
 * Re-encode an AI-generated image before it lands in R2. Raw provider output was
 * being uploaded unmodified (800KB-1.3MB PNGs), which the SEO audit flagged as an
 * LCP/page-weight problem site-wide. Downscales oversized dimensions and re-encodes
 * to JPEG (photographic AI-generated art compresses far better as JPEG than PNG, and
 * next/image's own optimizer still converts to WebP/AVIF on top of this) — unless
 * `keepAlpha` is set, in which case transparency is preserved and PNG is emitted.
 */
export async function compressGeneratedImage(
  buffer: Buffer,
  options: CompressOptions = {}
): Promise<{ buffer: Buffer; mime: string }> {
  const limit = options.maxDimension ?? MAX_DIMENSION;
  try {
    const resized = sharp(buffer).resize({
      width: limit,
      height: limit,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (options.keepAlpha) {
      // palette:true quantises to an indexed PNG, which is a large win on flat-colour
      // illustration and keeps a full alpha channel.
      const png = await resized.png({ compressionLevel: 9, palette: true }).toBuffer();
      return { buffer: png, mime: "image/png" };
    }

    const compressed = await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { buffer: compressed, mime: "image/jpeg" };
  } catch (err) {
    console.error("[compressGeneratedImage] compression failed, uploading original:", err);
    return { buffer, mime: "image/png" };
  }
}
