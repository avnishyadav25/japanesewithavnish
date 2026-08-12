import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { plannedVideoCount, resolveScope } from "@/lib/video/scopeResolver";
import type { ScopeKind, ScopeRef } from "@/lib/video/types";

/** Resolves a scope without creating anything, so the wizard can show what a project will
 * actually cover — and, importantly, how many videos it will queue — before an admin commits
 * to it. A "one video per item" batch over an unfiltered content type is thousands of renders;
 * the count needs to be visible at the point of decision, not discovered afterwards. */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const scopeKind = body?.scopeKind as ScopeKind | undefined;
  const scopeRef = (body?.scopeRef ?? {}) as ScopeRef;
  const grouping = body?.grouping === "video_per_item" ? "video_per_item" : "single_video";

  if (!scopeKind) return NextResponse.json({ error: "scopeKind is required" }, { status: 400 });

  try {
    const snapshot = await resolveScope(scopeKind, scopeRef);
    return NextResponse.json({
      title: snapshot.title,
      jlptLevel: snapshot.jlptLevel ?? null,
      itemCount: snapshot.items.length,
      plannedVideos: plannedVideoCount(snapshot, grouping),
      items: snapshot.items.slice(0, 25).map((item) => ({
        title: item.title,
        kind: item.kind,
        url: item.url ?? null,
        jlptLevel: item.jlptLevel ?? null,
        exampleCount: item.examples.length,
      })),
    });
  } catch (err) {
    // A scope that resolves to nothing is a normal, expected outcome of over-tight filters —
    // report it as a 400 with the resolver's message rather than a 500.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve scope" }, { status: 400 });
  }
}
