import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendFeedbackNotification } from "@/lib/email";

// Simple in-memory rate limiter
const ipSubmissions = new Map<string, { count: number; resetTime: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. IP Rate Limiting
    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const limitInfo = ipSubmissions.get(ip);
    
    if (limitInfo) {
      if (now < limitInfo.resetTime) {
        if (limitInfo.count >= 5) {
          return NextResponse.json({ error: "Too many feedback submissions. Please try again in 15 minutes." }, { status: 429 });
        }
        limitInfo.count += 1;
      } else {
        ipSubmissions.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
      }
    } else {
      ipSubmissions.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    }

    // 2. Honeypot Check (bots fill this, humans don't)
    if (body.website && typeof body.website === "string" && body.website.trim().length > 0) {
      return NextResponse.json({ ok: true }); // Silent return to block bot spammers
    }

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
