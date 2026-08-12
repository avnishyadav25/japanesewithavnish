import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { listJobs, listRenders } from "@/lib/video/projects";

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
  const renders = includeRenders ? await listRenders({ projectId, limit: 20 }) : undefined;

  return NextResponse.json({ jobs, renders });
}
