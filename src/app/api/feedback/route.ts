import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendFeedbackNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!message || message.length > 2000) {
      return NextResponse.json(
        { error: "Message is required (max 2000 characters)." },
        { status: 400 }
      );
    }

    if (sql) {
      await sql`
        INSERT INTO feedback (name, email, message)
        VALUES (${name || null}, ${email || null}, ${message})
      `;
    }

    const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || "";
    if (adminEmail) {
      try {
        await sendFeedbackNotification(adminEmail, name, email, message);
      } catch (emailErr) {
        console.error("Feedback email failed:", emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback submission:", e);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }
}
