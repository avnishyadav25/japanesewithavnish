/**
 * Storage migration: Supabase Storage → Cloudflare R2.
 * Lists objects in Supabase bucket(s), downloads each, uploads to R2 with same path.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_* (endpoint, keys, bucket).
 * Optional: SUPABASE_STORAGE_BUCKET=bucket1,bucket2 (default: list all buckets and migrate each).
 *
 *   npx tsx scripts/migrate-storage-supabase-to-r2.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(repoRoot: string): void {
  const p = resolve(repoRoot, ".env");
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const REPO_ROOT = resolve(__dirname, "..");
loadEnv(REPO_ROOT);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const BUCKETS_ENV = process.env.SUPABASE_STORAGE_BUCKET; // optional: comma-separated bucket names

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Need R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

type FileItem = { name: string; id: string | null };

async function listAllKeys(bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  const { data: items, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    console.warn(`  list ${bucket}/${prefix}: ${error.message}`);
    return keys;
  }
  for (const item of items || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if ((item as FileItem).id != null) {
      keys.push(fullPath);
    } else {
      const nested = await listAllKeys(bucket, fullPath);
      keys.push(...nested);
    }
  }
  return keys;
}

async function main() {
  let buckets: string[];
  if (BUCKETS_ENV?.trim()) {
    buckets = BUCKETS_ENV.split(",").map((b) => b.trim()).filter(Boolean);
  } else {
    const { data: list, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error("List buckets:", error.message);
      process.exit(1);
    }
    buckets = (list || []).map((b) => b.name);
  }
  if (buckets.length === 0) {
    console.log("No buckets to migrate.");
    return;
  }

  for (const bucket of buckets) {
    console.log(`Bucket: ${bucket}`);
    const keys = await listAllKeys(bucket, "");
    for (const key of keys) {
      const { data: blob, error: downErr } = await supabase.storage.from(bucket).download(key);
      if (downErr || !blob) {
        console.warn(`  skip ${key}: ${downErr?.message || "no data"}`);
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const r2Key = buckets.length > 1 ? `${bucket}/${key}` : key;
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME!,
          Key: r2Key,
          Body: buf,
          ContentType: blob.type || undefined,
        })
      );
      console.log(`  ${key} → R2 ${r2Key}`);
    }
    console.log(`  ${bucket}: ${keys.length} objects.`);
  }
  console.log("Storage migration done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
