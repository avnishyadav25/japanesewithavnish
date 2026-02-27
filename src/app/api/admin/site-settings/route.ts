import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: Request) {
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

    for (const [key, value] of Object.entries(body)) {
      await admin
        .from("site_settings")
        .upsert(
          { key, value: value ?? null, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site settings save:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
