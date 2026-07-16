import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isReviewEntityType } from "@/lib/contentReview/types";

const REPORT_CATEGORIES = [
  "japanese_mistake", "wrong_meaning", "wrong_reading", "wrong_answer",
  "audio_problem", "broken_image", "too_difficult", "unclear", "duplicate", "other",
];

// Same in-memory rate-limit shape as src/app/api/feedback/route.ts.
const ipSubmissions = new Map<string, { count: number; resetTime: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const limitInfo = ipSubmissions.get(ip);
    if (limitInfo) {
      if (now < limitInfo.resetTime) {
        if (limitInfo.count >= 10) {
          return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
        }
        limitInfo.count += 1;
      } else {
        ipSubmissions.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
      }
    } else {
      ipSubmissions.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    }

    if (body.website && typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ ok: true }); // honeypot — silent success for bots
    }

    const { entityType, entityId, category } = body;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : null;
    const reporterEmail = typeof body.reporterEmail === "string" ? body.reporterEmail.trim().slice(0, 200) : null;

    if (typeof entityType !== "string" || !isReviewEntityType(entityType) || typeof entityId !== "string" || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }
    if (typeof category !== "string" || !REPORT_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    await sql`
      INSERT INTO learner_content_reports (entity_type, entity_id, category, message, reporter_email)
      VALUES (${entityType}, ${entityId}, ${category}, ${message}, ${reporterEmail})
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Learner content report:", e);
    return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
  }
}
