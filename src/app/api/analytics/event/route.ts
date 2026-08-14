import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db";

const VALID_CONTENT_TYPES = ["blog", "product", "page", "newsletter"];
const VALID_EVENT_TYPES = ["view", "duration"];

function truncate(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function getHeader(req: NextRequest, names: string[]): string | null {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return value;
  }
  return null;
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = getHeader(req, [
    "x-nf-client-connection-ip",
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
  ]);
  if (!forwarded) return null;
  return forwarded.split(",")[0]?.trim() || null;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_HASH_SALT || process.env.JWT_SECRET || "jwa-analytics";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function parseUserAgent(userAgent: string | null) {
  const ua = userAgent || "";
  const device_type = /ipad|tablet/i.test(ua) ? "tablet" : /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /safari/i.test(ua)
        ? "Safari"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : "unknown";
  const os = /iphone|ipad|ios/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /mac os|macintosh/i.test(ua)
        ? "macOS"
        : /windows/i.test(ua)
          ? "Windows"
          : /linux/i.test(ua)
            ? "Linux"
            : "unknown";
  return { device_type, browser, os };
}

function utmFromPath(path: string | null, body: Record<string, unknown>, key: string): string | null {
  const direct = truncate(body[key], 100);
  if (direct) return direct;
  if (!path) return null;
  try {
    const url = new URL(path, "https://japanesewithavnish.com");
    return truncate(url.searchParams.get(key), 100);
  } catch {
    return null;
  }
}

function isMissingColumnError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "42703"
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "valid JSON body required" }, { status: 400 });
    }
    const content_type = String(body.content_type ?? "").toLowerCase();
    const content_id = String(body.content_id ?? "");
    const event_type = String(body.event_type ?? "view").toLowerCase();
    const duration_seconds = typeof body.duration_seconds === "number" ? Math.round(body.duration_seconds) : null;
    const session_id = truncate(body.session_id, 64);
    const path = truncate(body.path, 500);
    const referrer = truncate(body.referrer, 500);
    const utm_source = utmFromPath(path, body as Record<string, unknown>, "utm_source");
    const utm_medium = utmFromPath(path, body as Record<string, unknown>, "utm_medium");
    const utm_campaign = utmFromPath(path, body as Record<string, unknown>, "utm_campaign");
    const country = truncate(getHeader(req, ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"]) || body.country, 80) || "unknown";
    const region = truncate(getHeader(req, ["x-vercel-ip-country-region"]) || body.region, 100);
    const city = truncate(getHeader(req, ["x-vercel-ip-city"]) || body.city, 100);
    const { device_type, browser, os } = parseUserAgent(req.headers.get("user-agent"));
    const ip_hash = hashIp(getClientIp(req));

    if (!content_type || !VALID_CONTENT_TYPES.includes(content_type) || !content_id) {
      return NextResponse.json({ error: "content_type and content_id required" }, { status: 400 });
    }
    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
    }

    try {
      await sql`
        INSERT INTO content_events (
          content_type, content_id, event_type, duration_seconds, session_id, path, referrer,
          utm_source, utm_medium, utm_campaign, country, region, city, device_type, browser, os, ip_hash
        )
        VALUES (
          ${content_type}, ${content_id}, ${event_type}, ${duration_seconds}, ${session_id}, ${path}, ${referrer},
          ${utm_source}, ${utm_medium}, ${utm_campaign}, ${country}, ${region}, ${city}, ${device_type}, ${browser}, ${os}, ${ip_hash}
        )
      `;
    } catch (insertError) {
      if (!isMissingColumnError(insertError)) throw insertError;
      await sql`
        INSERT INTO content_events (content_type, content_id, event_type, duration_seconds, session_id, path, referrer)
        VALUES (${content_type}, ${content_id}, ${event_type}, ${duration_seconds}, ${session_id}, ${path}, ${referrer})
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Analytics event:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
