import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { R2_NOT_CONFIGURED_MESSAGE, deleteFromR2, getR2, r2KeyFromUrl } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    if (!getR2()) {
      return NextResponse.json({ error: R2_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    // Refuses to delete anything outside our own bucket — the URL arrives from the client, so
    // this is the guard that stops it being used to issue arbitrary deletes.
    const key = r2KeyFromUrl(url);
    if (key === null) {
      return NextResponse.json({ error: "URL does not belong to configured bucket" }, { status: 400 });
    }
    if (!key) {
      return NextResponse.json({ error: "Invalid object key derived from URL" }, { status: 400 });
    }

    await deleteFromR2(key);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete image:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete image" },
      { status: 500 }
    );
  }
}
