import { sql } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

/**
 * Build the markdown context string for japani-bhai (blogs + products + support).
 * Includes published learning_content for Nihongo Navi / tutor context.
 * Does not save to DB.
 */
export async function buildChatbotContext(): Promise<string> {
  if (!sql) return "";

  const postRows = await sql`
    SELECT slug, title, summary, seo_description, jlpt_level, tags
    FROM posts
    WHERE status = 'published' AND (content_type IS NULL OR content_type = 'blog')
    ORDER BY published_at DESC
  ` as { slug: string; title: string; summary: string | null; seo_description: string | null; jlpt_level: string[] | null; tags: string[] | null }[];

  const productRows = await sql`
    SELECT slug, name, price_paise, jlpt_level, description
    FROM products ORDER BY sort_order ASC
  ` as { slug: string; name: string; price_paise: number; jlpt_level: string | null; description: string | null }[];

  const learnRows = await sql`
    SELECT slug, title, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, content
    FROM posts
    WHERE status = 'published'
      AND content_type IN ('grammar','vocabulary','kanji','reading','writing','listening','sounds','study_guide','practice_test')
    ORDER BY sort_order ASC, created_at DESC
    LIMIT 300
  ` as { slug: string; title: string; content_type: string; jlpt_level: string | null; tags: string[] | null; meta: unknown; content: string | null }[];

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
    "## Learning content (published – grammar, vocabulary, kanji, reading, writing)",
    ...(learnRows || []).map((l) => {
      const summary = typeof l.content === "string" ? l.content.slice(0, 300).replace(/\n/g, " ") : "";
      const meta = l.meta && typeof l.meta === "object" ? JSON.stringify(l.meta).slice(0, 150) : "";
      return `- **${l.title}** | ${BASE}/blog/${l.content_type}/${l.slug} | type: ${l.content_type} | JLPT: ${l.jlpt_level || "—"} | ${summary}${summary.length >= 300 ? "…" : ""} ${meta}`;
    }),
    "",
    "## Support",
    "- If a user did not receive their order confirmation email, ask for their **order ID** and **email**. Then direct them to request a resend: they can use the form at " + BASE + "/order/resend (or contact support).",
    "",
  ];

  return lines.join("\n");
}
