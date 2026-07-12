import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/account",
        "/library",
        "/checkout",
        "/order",
        "/thank-you",
        "/payment-",
        "/reset-password",
        "/login",
        "/access",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
