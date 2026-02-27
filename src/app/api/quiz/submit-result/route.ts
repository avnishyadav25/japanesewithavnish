import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuizResults } from "@/lib/email";

const THRESHOLDS = [
  { level: "N5", minScore: 0, productSlug: "japanese-n5-mastery-bundle", productName: "Japanese N5 Mastery Bundle" },
  { level: "N4", minScore: 3, productSlug: "japanese-n4-upgrade-bundle", productName: "Japanese N4 Upgrade Bundle" },
  { level: "N3", minScore: 5, productSlug: "japanese-n3-power-bundle", productName: "Japanese N3 Power Bundle" },
  { level: "N2", minScore: 7, productSlug: "japanese-n2-pro-bundle", productName: "Japanese N2 Pro Bundle" },
  { level: "N1", minScore: 9, productSlug: "japanese-n1-elite-bundle", productName: "Japanese N1 Elite Bundle" },
];

export async function POST(req: Request) {
  try {
    const { email, score, total, newsletterOptIn } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const rec = [...THRESHOLDS].reverse().find((t) => (score || 0) >= t.minScore) || THRESHOLDS[0];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const supabase = createAdminClient();
    if (newsletterOptIn !== false) {
      await supabase
        .from("subscribers")
        .upsert({ email, source: "quiz" }, { onConflict: "email" });
    }
    await supabase.from("quiz_attempts").insert({
      email,
      score: score || 0,
      total_questions: total || 10,
      recommended_level: rec.level,
    });

    try {
      await sendQuizResults(
        email,
        rec.level,
        rec.productName,
        `${siteUrl}/product/${rec.productSlug}`
      );
    } catch (e) {
      console.error("Quiz email error:", e);
    }

    return NextResponse.json({ success: true, level: rec.level });
  } catch (e) {
    console.error("Submit result:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
