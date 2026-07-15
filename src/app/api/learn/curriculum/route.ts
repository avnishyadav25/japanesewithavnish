import { NextResponse } from "next/server";
import { getCurriculumData } from "@/lib/curriculum-data";

export type { PathStep } from "@/lib/curriculum-data";

/** Public: full curriculum tree + optional flat path (pathSteps, progress, totalEstimatedMinutes). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pathOnly = url.searchParams.get("path") === "1";

  try {
    const payload = await getCurriculumData(pathOnly);
    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    console.error("Curriculum GET:", e);
    return NextResponse.json({
      levels: [],
      pathSteps: [],
      totalEstimatedMinutes: 0,
      pathProgressPercent: 0,
    });
  }
}
