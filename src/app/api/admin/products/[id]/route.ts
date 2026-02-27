import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const admin = createAdminClient();

    const update: Record<string, unknown> = {};

    // Basic info
    if (body.name !== undefined) update.name = body.name || null;
    if (body.slug !== undefined) update.slug = body.slug || null;
    if (body.description !== undefined) update.description = body.description || null;
    if (body.is_mega !== undefined) update.is_mega = Boolean(body.is_mega);

    // Pricing
    if (body.price_paise !== undefined) update.price_paise = Number(body.price_paise) || null;
    if (body.compare_price_paise !== undefined)
      update.compare_price_paise = body.compare_price_paise ? Number(body.compare_price_paise) : null;

    // Classification
    if (body.badge !== undefined) update.badge = body.badge || null;
    if (body.jlpt_level !== undefined) update.jlpt_level = body.jlpt_level || null;
    if (body.preview_url !== undefined) update.preview_url = body.preview_url || null;

    // Product copy
    if (body.who_its_for !== undefined) update.who_its_for = body.who_its_for || null;
    if (body.outcome !== undefined) update.outcome = body.outcome || null;
    if (body.whats_included !== undefined) update.whats_included = body.whats_included ?? null;
    if (body.faq !== undefined) update.faq = body.faq ?? null;
    if (body.no_refunds_note !== undefined) update.no_refunds_note = body.no_refunds_note || null;

    // Images
    if (body.image_url !== undefined) update.image_url = body.image_url || null;
    if (body.image_prompt !== undefined) update.image_prompt = body.image_prompt || null;
    if (body.gallery_images !== undefined) update.gallery_images = body.gallery_images ?? [];

    const { error } = await admin
      .from("products")
      .update(update)
      .eq("id", params.id);

    if (error) {
      console.error("Update product error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update product:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
