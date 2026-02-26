import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "bundle-assets";
const EXPIRY_SECONDS = 30 * 60; // 30 minutes

export async function GET(req: NextRequest) {
  try {
    const assetId = req.nextUrl.searchParams.get("asset_id");
    if (!assetId) {
      return NextResponse.json({ error: "asset_id required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: asset, error: assetError } = await admin
      .from("product_assets")
      .select("id, storage_path, product_id")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const { data: entitlement } = await admin
      .from("entitlements")
      .select("id")
      .eq("user_email", user.email)
      .eq("product_id", asset.product_id)
      .eq("active", true)
      .single();

    if (!entitlement) {
      return NextResponse.json({ error: "No access to this asset" }, { status: 403 });
    }

    await admin.from("download_logs").insert({
      user_email: user.email,
      asset_id: assetId,
    });

    const { data: signedUrl, error: urlError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(asset.storage_path, EXPIRY_SECONDS);

    if (urlError || !signedUrl?.signedUrl) {
      console.error("Signed URL error:", urlError);
      return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (e) {
    console.error("Download error:", e);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
