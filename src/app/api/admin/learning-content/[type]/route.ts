import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type } = await params;
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const body = await req.json();
    const { slug, title, content, jlpt_level, tags, status, sort_order } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("learning_content")
      .insert({
        content_type: type,
        slug: String(slug).trim(),
        title: String(title).trim(),
        content: content ?? null,
        jlpt_level: jlpt_level || null,
        tags: Array.isArray(tags) ? tags : [],
        status: status === "published" ? "published" : "draft",
        sort_order: typeof sort_order === "number" ? sort_order : 0,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw error;
    }

    return NextResponse.json({ id: data?.id, slug });
  } catch (e) {
    console.error("Learning content create:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
