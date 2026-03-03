import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const HOMEPAGE_KEYS = [
  "announcement_bar",
  "bundle_comparison",
  "study_roadmap",
  "homepage_feature_strip",
  "testimonials_about",
  "homepage_faq",
] as const;

export async function GET() {
  try {
    if (sql) {
      const rows = (await sql`
        SELECT key, value FROM site_settings
        WHERE key = ANY(${HOMEPAGE_KEYS as unknown as string[]})
      `) as { key: string; value: unknown }[];
      const settings: Record<string, unknown> = {};
      rows.forEach((r) => {
        settings[r.key] = r.value;
      });
      return NextResponse.json(settings, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }
    return NextResponse.json(defaultSettings(), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("Public settings:", e);
    return NextResponse.json(defaultSettings(), {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" },
    });
  }
}

function defaultSettings(): Record<string, unknown> {
  return {};
}
