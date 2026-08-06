import sharp from "sharp";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 78;

/**
 * Re-encode an AI-generated image before it lands in R2. Raw provider output was
 * being uploaded unmodified (800KB-1.3MB PNGs), which the SEO audit flagged as an
 * LCP/page-weight problem site-wide. Downscales oversized dimensions and always
 * re-encodes to JPEG (photographic AI-generated art compresses far better as JPEG
 * than PNG, and next/image's own optimizer still converts to WebP/AVIF on top of this).
 */
export async function compressGeneratedImage(
  buffer: Buffer
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const compressed = await sharp(buffer)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buffer: compressed, mime: "image/jpeg" };
  } catch (err) {
    console.error("[compressGeneratedImage] compression failed, uploading original:", err);
    return { buffer, mime: "image/png" };
  }
}
