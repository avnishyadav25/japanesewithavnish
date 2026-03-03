import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
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
    const nameVal = name && typeof name === "string" ? name.trim() : null;

    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const existing = await sql`SELECT id FROM subscribers WHERE email = ${trimmed} LIMIT 1`;
    await sql`
      INSERT INTO subscribers (email, name, source)
      VALUES (${trimmed}, ${nameVal}, ${subscribeSource})
      ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, subscribers.name), source = EXCLUDED.source
    `;

    if (!existing?.length) {
      sendWelcomeNewsletter(trimmed, nameVal ?? undefined).catch((err) =>
        console.error("Welcome email:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Subscribe:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
