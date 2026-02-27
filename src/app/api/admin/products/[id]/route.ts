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

    const {
      who_its_for,
      outcome,
      whats_included,
      faq,
      badge,
      jlpt_level,
      no_refunds_note,
      preview_url,
    } = body as {
      who_its_for?: string | null;
      outcome?: string | null;
      whats_included?: string[] | null;
      faq?: { q: string; a: string }[] | null;
      badge?: string | null;
      jlpt_level?: string | null;
      no_refunds_note?: string | null;
      preview_url?: string | null;
    };

    const update: Record<string, unknown> = {
      who_its_for: who_its_for ?? null,
      outcome: outcome ?? null,
      whats_included: whats_included ?? null,
      faq: faq ?? null,
      badge: badge ?? null,
      jlpt_level: jlpt_level ?? null,
      no_refunds_note: no_refunds_note ?? null,
      preview_url: preview_url ?? null,
    };

    const { error } = await admin
      .from("products")
      .update(update)
      .eq("id", params.id);

    if (error) {
      console.error("Update product meta error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update product meta:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

