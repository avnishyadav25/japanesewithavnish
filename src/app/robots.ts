import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

// Personalized/no-SEO-value pages, kept out of the crawl regardless of user agent.
const DISALLOW_PATHS = [
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
  "/learn/dashboard",
  "/billing",
];

// AI answer/retrieval bots — allowed, so pages can be cited in AI-generated
// answers (ChatGPT, Perplexity, Claude, Google AI Overviews, Apple Intelligence).
const AI_ANSWER_BOTS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Applebot-Extended"];

// AI training bots — blocked site-wide, so paid JLPT content and free blog
// content aren't scraped into model training sets without attribution/compensation.
const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "CCBot", "Bytespider"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      ...AI_ANSWER_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW_PATHS,
      })),
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
