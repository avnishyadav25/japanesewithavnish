import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Map product slug → BUNDLE_*_DRIVE_URL env var
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

export async function GET(req: NextRequest) {
  try {
    const productId = req.nextUrl.searchParams.get("product_id");
    if (!productId) {
      return NextResponse.json({ error: "product_id required" }, { status: 400 });
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Entitlement check
    const { data: entitlement } = await admin
      .from("entitlements")
      .select("id")
      .eq("user_email", user.email)
      .eq("product_id", productId)
      .eq("active", true)
      .maybeSingle();

    if (!entitlement) {
      return NextResponse.json({ error: "No access to this product" }, { status: 403 });
    }

    // Look up product slug to get Drive URL
    const { data: product } = await admin
      .from("products")
      .select("slug")
      .eq("id", productId)
      .single();

    if (!product?.slug) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const driveUrl = getDriveUrl(product.slug);
    if (!driveUrl) {
      return NextResponse.json({ error: "Download not configured for this product" }, { status: 404 });
    }

    // Log download (non-blocking)
    try {
      await admin.from("download_logs").insert({
        user_email: user.email,
        asset_id: productId,
      });
    } catch { /* ignore log errors */ }

    return NextResponse.json({ url: driveUrl });
  } catch (e) {
    console.error("Download error:", e);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
