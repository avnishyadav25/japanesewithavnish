import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", HOMEPAGE_KEYS);

    if (error) {
      console.error("Public settings:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const settings: Record<string, unknown> = {};
    rows?.forEach((r) => {
      settings[r.key] = r.value;
    });

    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    console.error("Public settings:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
