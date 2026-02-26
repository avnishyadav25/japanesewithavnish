import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user?.email || !ADMIN_EMAILS.includes(data.user.email.toLowerCase())) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Not an admin" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin login:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
