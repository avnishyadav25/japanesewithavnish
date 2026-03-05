import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendContactFormNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Please enter your name (max 200 characters)." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!message || message.length > 5000) {
      return NextResponse.json({ error: "Please enter a message (max 5000 characters)." }, { status: 400 });
    }

    let contactEmail = process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || "";
    if (!contactEmail && sql) {
      const rows = await sql`
        SELECT value FROM site_settings WHERE key IN ('contact_email', 'support_email') LIMIT 1
      ` as { value: string }[];
      contactEmail = rows[0]?.value ?? "";
    }

    if (!contactEmail) {
      return NextResponse.json(
        { error: "Contact form is not configured. Please set contact_email in site settings or CONTACT_EMAIL in environment." },
        { status: 503 }
      );
    }

    if (sql) {
      await sql`
        INSERT INTO contact_submissions (name, email, message, status)
        VALUES (${name}, ${email}, ${message}, 'new')
      `;
    }

    try {
      await sendContactFormNotification(contactEmail, name, email, message);
    } catch (emailErr) {
      console.error("Contact form email failed:", emailErr);
      // Submission already saved; still return success
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact form:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send message. Please try again or email us directly." },
      { status: 500 }
    );
  }
}
