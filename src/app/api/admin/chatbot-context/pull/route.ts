import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { buildChatbotContext } from "@/lib/chatbot-context";

export async function POST() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const content = await buildChatbotContext();
    const updatedAt = new Date().toISOString();

    const value = { content, updatedAt };
    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('chatbot_context', ${value}, ${updatedAt})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ success: true, updatedAt, length: content.length });
  } catch (e) {
    console.error("Chatbot context pull:", e);
    return NextResponse.json({ error: "Failed to update context" }, { status: 500 });
  }
}
