import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function POST() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const postRows = await sql`
      SELECT slug, title, summary, seo_description, jlpt_level, tags
      FROM posts WHERE status = 'published' ORDER BY published_at DESC
    ` as { slug: string; title: string; summary: string | null; seo_description: string | null; jlpt_level: string[] | null; tags: string[] | null }[];

    const productRows = await sql`
      SELECT slug, name, price_paise, jlpt_level, description
      FROM products ORDER BY sort_order ASC
    ` as { slug: string; name: string; price_paise: number; jlpt_level: string | null; description: string | null }[];

    const lines: string[] = [
      "# Japanese with Avnish – Context for japani-bhai",
      "",
      "## Blogs (published)",
      ...(postRows || []).map((p) => {
        const level = Array.isArray(p.jlpt_level) ? p.jlpt_level.join(", ") : p.jlpt_level || "";
        const tags = Array.isArray(p.tags) ? p.tags.join(", ") : "";
        const summary = p.summary || p.seo_description || "";
        return `- **${p.title}** | ${BASE}/blog/${p.slug} | JLPT: ${level} | Tags: ${tags} | ${summary.slice(0, 200)}${summary.length > 200 ? "…" : ""}`;
      }),
      "",
      "## Bundles / Products",
      ...(productRows || []).map((p) => {
        const price = (p.price_paise / 100).toFixed(0);
        const desc = (p.description || "").slice(0, 150);
        return `- **${p.name}** | ${BASE}/product/${p.slug} | ₹${price} | JLPT: ${p.jlpt_level || "—"} | ${desc}${desc.length >= 150 ? "…" : ""}`;
      }),
      "",
      "## Support",
      "- If a user did not receive their order confirmation email, ask for their **order ID** and **email**. Then direct them to request a resend: they can use the form at " + BASE + "/order/resend (or contact support).",
      "",
    ];

    const content = lines.join("\n");
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
