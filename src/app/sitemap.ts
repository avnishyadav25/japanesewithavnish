import { MetadataRoute } from "next";
import { sql } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/start-here", priority: 0.8, changeFrequency: "weekly" },
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
    { path: "/learn", priority: 0.8, changeFrequency: "weekly" },
    { path: "/store", priority: 0.8, changeFrequency: "weekly" },
    { path: "/quiz", priority: 0.8, changeFrequency: "weekly" },
    { path: "/login", priority: 0.5, changeFrequency: "monthly" },
    { path: "/library", priority: 0.5, changeFrequency: "monthly" },
    { path: "/free-n5-pack", priority: 0.8, changeFrequency: "weekly" },
    { path: "/thank-you", priority: 0.5, changeFrequency: "monthly" },
    { path: "/policies/privacy", priority: 0.4, changeFrequency: "monthly" },
    { path: "/policies/terms", priority: 0.4, changeFrequency: "monthly" },
    { path: "/policies/refunds", priority: 0.4, changeFrequency: "monthly" },
    { path: "/jlpt", priority: 0.8, changeFrequency: "weekly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = [];
  const productEntries: MetadataRoute.Sitemap = [];

  if (sql) {
    try {
      const postRows = await sql`
        SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY updated_at DESC
      ` as { slug: string; updated_at: string }[];
      blogEntries.push(
        ...(postRows || []).map((row) => ({
          url: `${BASE}/blog/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7 as number,
        }))
      );
    } catch {
      // ignore
    }
    try {
      const productRows = await sql`
        SELECT slug, updated_at FROM products ORDER BY sort_order ASC
      ` as { slug: string; updated_at: string | null }[];
      productEntries.push(
        ...(productRows || []).map((row) => ({
          url: `${BASE}/product/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7 as number,
        }))
      );
    } catch {
      // ignore
    }
  }

  return [...staticEntries, ...blogEntries, ...productEntries];
}
