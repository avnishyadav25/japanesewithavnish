import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

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

    if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

    const existingRows = (await sql`SELECT * FROM products WHERE id = ${id}`) as Record<string, unknown>[];
    const existing = existingRows?.[0];
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const merged = { ...existing, ...update };

    await sql`
      UPDATE products SET
        name = ${merged.name},
        slug = ${merged.slug},
        description = ${merged.description},
        is_mega = ${merged.is_mega},
        price_paise = ${merged.price_paise},
        compare_price_paise = ${merged.compare_price_paise},
        badge = ${merged.badge},
        jlpt_level = ${merged.jlpt_level},
        preview_url = ${merged.preview_url},
        who_its_for = ${merged.who_its_for},
        outcome = ${merged.outcome},
        whats_included = ${merged.whats_included},
        faq = ${merged.faq},
        no_refunds_note = ${merged.no_refunds_note},
        image_url = ${merged.image_url},
        image_prompt = ${merged.image_prompt},
        gallery_images = ${merged.gallery_images}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update product:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
