import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { verifyAccessToken } from "@/lib/access-tokens";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Map product slug → BUNDLE_*_DRIVE_URL env var (fallback when no R2 storage_path)
const SLUG_TO_DRIVE_ENV: Record<string, string> = {
  "complete-japanese-n5-n1-mega-bundle": "BUNDLE_MEGA_DRIVE_URL",
  "japanese-n5-mastery-bundle": "BUNDLE_N5_DRIVE_URL",
  "japanese-n4-upgrade-bundle": "BUNDLE_N4_DRIVE_URL",
  "japanese-n3-power-bundle": "BUNDLE_N3_DRIVE_URL",
  "japanese-n2-pro-bundle": "BUNDLE_N2_DRIVE_URL",
  "japanese-n1-elite-bundle": "BUNDLE_N1_DRIVE_URL",
  "free-n5-pack": "BUNDLE_FREE_STARTER_KIT_DRIVE_URL",
  "free-n5-starter-kit": "BUNDLE_FREE_STARTER_KIT_DRIVE_URL",
};

function getDriveUrl(slug: string): string | null {
  const envKey = SLUG_TO_DRIVE_ENV[slug];
  if (!envKey) return null;
  return process.env[envKey] || null;
}

function getR2Url(storagePath: string): string | null {
  const base = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
  if (!base || !storagePath?.trim()) return null;
  const path = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  return `${base}/${path}`;
}

export async function GET(req: NextRequest) {
  try {
    const assetId = req.nextUrl.searchParams.get("asset_id");
    if (!assetId) {
      return NextResponse.json({ error: "asset_id required" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Download service unavailable" }, { status: 503 });
    }
    const assetRows = await sql`SELECT product_id, storage_path FROM product_assets WHERE id = ${assetId} LIMIT 1` as { product_id: string; storage_path: string }[];
    const productId = assetRows[0]?.product_id ?? null;
    const storagePath = assetRows[0]?.storage_path ?? null;
    if (!productId) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    let userEmail: string | null = (await getSession())?.email ?? null;
    if (!userEmail) {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("access_token")?.value;
      if (accessToken) {
        const payload = await verifyAccessToken(accessToken);
        if (payload) userEmail = payload.email;
      }
    }
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entitlementRows = await sql`
      SELECT id FROM entitlements
      WHERE user_email = ${userEmail} AND product_id = ${productId} AND active = true
      LIMIT 1
    `;
    if (entitlementRows.length === 0) {
      return NextResponse.json({ error: "No access to this product" }, { status: 403 });
    }
    const productRows = await sql`SELECT slug FROM products WHERE id = ${productId} LIMIT 1`;
    const slug = productRows[0]?.slug ?? null;
    try {
      await sql`INSERT INTO download_logs (user_email, asset_id) VALUES (${userEmail}, ${assetId})`;
    } catch { /* ignore */ }

    if (!slug) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const r2Url = getR2Url(storagePath ?? "");
    if (r2Url) {
      return NextResponse.json({ url: r2Url });
    }
    const driveUrl = getDriveUrl(slug);
    if (!driveUrl) {
      return NextResponse.json({ error: "Download not configured for this product" }, { status: 404 });
    }
    return NextResponse.json({ url: driveUrl });
  } catch (e) {
    console.error("Download error:", e);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
