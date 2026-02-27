import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeNewsletter } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email, name, source } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const subscribeSource = source && typeof source === "string" ? source : "footer";

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", trimmed)
      .single();

    const { error } = await supabase.from("subscribers").upsert(
      {
        email: trimmed,
        name: name && typeof name === "string" ? name.trim() : null,
        source: subscribeSource,
      },
      { onConflict: "email" }
    );

    if (error) {
      console.error("Subscribe:", error);
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    if (!existing) {
      sendWelcomeNewsletter(trimmed, name?.trim()).catch((err) =>
        console.error("Welcome email:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Subscribe:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
