import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

/** Launches Chromium appropriately for the current runtime: the full local browser
 * install (from the `playwright` devDependency) when running on a developer's machine,
 * or @sparticuz/chromium's Lambda/Netlify-Functions-compatible binary (Linux-only,
 * extracted from the npm package at runtime) when running in serverless production. */
async function launchBrowser() {
  if (process.platform === "linux" && process.env.NODE_ENV === "production") {
    const { chromium } = await import("playwright-core");
    const chromiumBinary = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = (await sql`
    SELECT slug, published FROM platform_guide_sections WHERE id::text = ${id} LIMIT 1
  `) as { slug: string | null; published: boolean }[];
  const section = rows[0];
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!section.slug) return NextResponse.json({ error: "Section has no slug yet — save it first" }, { status: 400 });
  if (!section.published) return NextResponse.json({ error: "Only published sections can be previewed live" }, { status: 400 });

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
  if (!r2 || !bucket || !bucketUrl) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/guide/${section.slug}`, { waitUntil: "networkidle", timeout: 20000 });
    const buffer = await page.screenshot({ fullPage: true, type: "png" });
    await browser.close();
    browser = null;

    const key = `guide-screenshots/${section.slug}-${Date.now()}.png`;
    await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: "image/png" }));
    const screenshotUrl = `${bucketUrl}/${key}`;

    return NextResponse.json({ screenshotUrl });
  } catch (e) {
    console.error("Guide screenshot error:", e);
    const msg = e instanceof Error ? e.message : "Failed to capture screenshot";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
