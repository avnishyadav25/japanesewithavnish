import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/start-here",
    "/blog",
    "/store",
    "/quiz",
    "/login",
    "/library",
    "/thank-you",
    "/policies/privacy",
    "/policies/terms",
    "/policies/refunds",
  ];

  const jlpt = ["n5", "n4", "n3", "n2", "n1"].map((l) => `/jlpt/${l}`);

  return [
    ...staticPages.map((path) => ({
      url: `${BASE}${path || "/"}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...jlpt.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
