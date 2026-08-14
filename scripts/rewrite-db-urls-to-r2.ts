/**
 * Rewrite Supabase Storage URLs in the database to R2 URLs.
 * Run after storage migration and with Neon (DATABASE_URL) as the app DB.
 *
 * Env: DATABASE_URL, R2_BUCKET_URL
 *
 *   npx tsx scripts/rewrite-db-urls-to-r2.ts
 */

import { Client } from "pg";
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

const DATABASE_URL = process.env.DATABASE_URL;
const R2_BUCKET_URL = process.env.R2_BUCKET_URL?.replace(/\/$/, "");

if (!DATABASE_URL) {
  console.error("Need DATABASE_URL in .env");
  process.exit(1);
}
if (!R2_BUCKET_URL) {
  console.error("Need R2_BUCKET_URL in .env");
  process.exit(1);
}

const SUPABASE_STORAGE_PREFIX = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/(.+)$/;
const SUPABASE_STORAGE_GLOBAL = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/([^)\s\]"']+)/g;

function toR2Url(url: string): string {
  const m = url.match(SUPABASE_STORAGE_PREFIX);
  if (!m) return url;
  const path = m[1];
  return `${R2_BUCKET_URL}/${path}`;
}

function replaceAllInText(text: string): string {
  return text.replace(SUPABASE_STORAGE_GLOBAL, (_, path) => `${R2_BUCKET_URL}/${path}`);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // posts.og_image_url
    const postOg = await client.query<{ id: string; og_image_url: string }>(
      "SELECT id, og_image_url FROM posts WHERE og_image_url IS NOT NULL AND og_image_url LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of postOg.rows) {
      const newUrl = toR2Url(row.og_image_url);
      await client.query("UPDATE posts SET og_image_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log("posts.og_image_url:", row.id, "→", newUrl);
    }
    console.log("posts.og_image_url: updated", postOg.rowCount);

    // posts.content (markdown/HTML may contain image URLs)
    const postContent = await client.query<{ id: string; content: string | null }>(
      "SELECT id, content FROM posts WHERE content IS NOT NULL AND content LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of postContent.rows) {
      if (!row.content) continue;
      const newContent = replaceAllInText(row.content);
      await client.query("UPDATE posts SET content = $1 WHERE id = $2", [newContent, row.id]);
      console.log("posts.content: updated", row.id);
    }
    console.log("posts.content: updated", postContent.rowCount);

    // products.image_url
    const prodImg = await client.query<{ id: string; image_url: string }>(
      "SELECT id, image_url FROM products WHERE image_url IS NOT NULL AND image_url LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of prodImg.rows) {
      const newUrl = toR2Url(row.image_url);
      await client.query("UPDATE products SET image_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log("products.image_url:", row.id, "→", newUrl);
    }
    console.log("products.image_url: updated", prodImg.rowCount);

    // products.gallery_images (JSONB array of URLs)
    const prodGallery = await client.query<{ id: string; gallery_images: string[] | null }>(
      "SELECT id, gallery_images FROM products WHERE gallery_images::text LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of prodGallery.rows) {
      if (!Array.isArray(row.gallery_images)) continue;
      const rewritten = row.gallery_images.map((u) => (typeof u === "string" ? toR2Url(u) : u));
      await client.query("UPDATE products SET gallery_images = $1::jsonb WHERE id = $2", [
        JSON.stringify(rewritten),
        row.id,
      ]);
      console.log("products.gallery_images: updated", row.id);
    }
    console.log("products.gallery_images: updated", prodGallery.rowCount);

    // pages.og_image_url
    const pageOg = await client.query<{ id: string; og_image_url: string }>(
      "SELECT id, og_image_url FROM pages WHERE og_image_url IS NOT NULL AND og_image_url LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of pageOg.rows) {
      const newUrl = toR2Url(row.og_image_url);
      await client.query("UPDATE pages SET og_image_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log("pages.og_image_url:", row.id, "→", newUrl);
    }
    console.log("pages.og_image_url: updated", pageOg.rowCount);

    // pages.content
    const pageContent = await client.query<{ id: string; content: string | null }>(
      "SELECT id, content FROM pages WHERE content IS NOT NULL AND content LIKE $1",
      ["%supabase.co/storage%"]
    );
    for (const row of pageContent.rows) {
      if (!row.content) continue;
      const newContent = replaceAllInText(row.content);
      await client.query("UPDATE pages SET content = $1 WHERE id = $2", [newContent, row.id]);
      console.log("pages.content: updated", row.id);
    }
    console.log("pages.content: updated", pageContent.rowCount);
  } finally {
    await client.end();
  }
  console.log("URL rewrite to R2 done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
