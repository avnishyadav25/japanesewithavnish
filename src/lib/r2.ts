/**
 * Shared Cloudflare R2 (S3-compatible) access.
 *
 * Before this existed, an identical `getR2Client()` was copy-pasted into 7 route/lib files
 * (generate-image, create-reel-video, upload-avatar x2, upload-reference-image, delete-image,
 * db-backup, generateMockTest) — each with its own slightly different 503 message. Consolidated
 * here so the Video Studio worker and the app share one implementation.
 *
 * Deliberately free of any `next/*` import: `scripts/video-worker.ts` imports this by relative
 * path and runs under plain tsx, outside the Next runtime.
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const R2_NOT_CONFIGURED_MESSAGE =
  "R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_BUCKET_URL.";

export interface R2Config {
  client: S3Client;
  bucket: string;
  /** Public base URL, trailing slash stripped. */
  bucketUrl: string;
}

let cachedClient: S3Client | null = null;

/** The raw client, or null when credentials are unset. Callers that also need the bucket
 * name/public URL should use `getR2()` instead — it validates all five env vars at once. */
export function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/** Client + bucket + public base URL, or null if any of the five R2 env vars is missing.
 * This is the check every caller actually wants — a client alone is useless without a bucket. */
export function getR2(): R2Config | null {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
  if (!client || !bucket || !bucketUrl) return null;
  return { client, bucket, bucketUrl };
}

export function isR2Configured(): boolean {
  return getR2() !== null;
}

/** Public URL for a key. Throws if R2 is unconfigured — call `getR2()` first when you need
 * to degrade gracefully rather than throw. */
export function r2PublicUrl(key: string): string {
  const r2 = getR2();
  if (!r2) throw new Error(R2_NOT_CONFIGURED_MESSAGE);
  return `${r2.bucketUrl}/${key.replace(/^\//, "")}`;
}

export interface UploadOptions {
  /** Cache-Control header. Generated media is immutable (content-hashed or timestamped keys),
   * so the default is a one-year immutable cache. Pass `null` to omit the header entirely —
   * the routes that predate this module never set one, and this keeps their behaviour
   * byte-identical after being migrated onto it. */
  cacheControl?: string | null;
  contentDisposition?: string;
  metadata?: Record<string, string>;
}

/** Uploads a buffer/stream and returns its public URL. Throws if R2 is unconfigured. */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  options: UploadOptions = {}
): Promise<string> {
  const r2 = getR2();
  if (!r2) throw new Error(R2_NOT_CONFIGURED_MESSAGE);
  const normalizedKey = key.replace(/^\//, "");
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: normalizedKey,
      Body: body,
      ContentType: contentType,
      CacheControl:
        options.cacheControl === null ? undefined : options.cacheControl ?? "public, max-age=31536000, immutable",
      ContentDisposition: options.contentDisposition,
      Metadata: options.metadata,
    })
  );
  return `${r2.bucketUrl}/${normalizedKey}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  const r2 = getR2();
  if (!r2) throw new Error(R2_NOT_CONFIGURED_MESSAGE);
  await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key.replace(/^\//, "") }));
}

/** Downloads an object back into memory. Used by the render worker to pull cached TTS/B-roll
 * assets it did not produce in the current run. */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const r2 = getR2();
  if (!r2) throw new Error(R2_NOT_CONFIGURED_MESSAGE);
  const res = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key.replace(/^\//, "") }));
  const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) throw new Error(`R2 object ${key} returned no readable body`);
  return Buffer.from(await body.transformToByteArray());
}

/** Strips the public base URL back to a key, or null if the URL doesn't belong to this bucket.
 * Existing DB rows store absolute URLs, so deletes have to reverse the mapping. */
export function r2KeyFromUrl(url: string): string | null {
  const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
  if (!bucketUrl || !url.startsWith(`${bucketUrl}/`)) return null;
  return url.slice(bucketUrl.length + 1);
}
