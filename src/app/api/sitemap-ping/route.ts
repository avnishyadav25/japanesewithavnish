import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
const SITEMAP_URL = `${BASE}/sitemap.xml`;

/**
 * GET /api/sitemap-ping
 * Notifies Google and Bing that the sitemap has been updated.
 * Allowed: admin session (e.g. from dashboard) or ?key=CRON_SECRET (cron/deploy).
 * If CRON_SECRET is unset, endpoint is public.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  const admin = await getAdminSession();
  const allowedByKey = secret != null && secret !== "" && key === secret;
  const allowedByAdmin = !!admin;
  if (secret != null && secret !== "" && !allowedByKey && !allowedByAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isLocalhost =
    BASE.startsWith("http://localhost") ||
    BASE.startsWith("http://127.0.0.1") ||
    BASE.startsWith("https://localhost") ||
    BASE.startsWith("https://127.0.0.1");
  if (isLocalhost) {
    return NextResponse.json({
      sitemap: SITEMAP_URL,
      skipped: true,
      message:
        "Sitemap URL is localhost. Search engines can't reach it. Set NEXT_PUBLIC_SITE_URL to your production URL (e.g. https://japanesewithavnish.com) and ping from there.",
    });
  }

  const results: { provider: string; ok: boolean; status?: number }[] = [];

  try {
    const resGoogle = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
      { method: "GET" }
    );
    results.push({ provider: "google", ok: resGoogle.ok, status: resGoogle.status });
  } catch {
    results.push({ provider: "google", ok: false });
  }

  try {
    const resBing = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
      { method: "GET" }
    );
    results.push({ provider: "bing", ok: resBing.ok, status: resBing.status });
  } catch {
    results.push({ provider: "bing", ok: false });
  }

  return NextResponse.json({
    sitemap: SITEMAP_URL,
    pinged: results,
  });
}
