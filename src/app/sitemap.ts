import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/start-here",
    "/blog",
    "/learn",
    "/store",
    "/quiz",
    "/login",
    "/library",
    "/free-n5-pack",
    "/thank-you",
    "/policies/privacy",
    "/policies/terms",
    "/policies/refunds",
  ];

  const staticWithJlpt = [...staticPages, "/jlpt"];

  return staticWithJlpt.map((path) => ({
    url: `${BASE}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: path === "/jlpt" ? ("weekly" as const) : path === "" ? ("weekly" as const) : ("weekly" as const),
    priority: path === "" ? 1 : path === "/jlpt" ? 0.8 : 0.8,
  }));
}
