import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { buildChatbotContext } from "@/lib/chatbot-context";

/**
 * GET /api/admin/chatbot-context/preview
 * Build context from DB without saving (admin-only). Use to preview or diff before update.
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const content = await buildChatbotContext();
  return NextResponse.json({ content });
}
