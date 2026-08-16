import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { listJobs, listRenders } from "@/lib/video/projects";
import { attachPublications } from "@/lib/social/publications";

/** Polled by the admin job monitor and by the project page while a render is in flight.
 * This codebase has no SSE anywhere; progress is DB-row polling, same as the practice-test
 * generator modal and the content review runs page. */
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const active = url.searchParams.get("active") === "true";
  const includeRenders = url.searchParams.get("includeRenders") === "true";

  const jobs = await listJobs({ projectId, active, limit: Number(url.searchParams.get("limit") ?? 50) });
  // Limit 25 matches the project page's initial load. At 20 a poll silently dropped the five
  // oldest renders off a busy project, so cards appeared and vanished depending on which request
  // painted last. Publications are attached for the same reason — see attachPublications.
  const renders = includeRenders ? await attachPublications(await listRenders({ projectId, limit: 25 })) : undefined;

  return NextResponse.json({ jobs, renders });
}
