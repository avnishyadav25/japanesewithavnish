import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { R2_NOT_CONFIGURED_MESSAGE, getR2, uploadToR2 } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!getR2()) return NextResponse.json({ error: R2_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
    const key = `reference/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || (safeExt === "jpg" || safeExt === "jpeg" ? "image/jpeg" : "image/png");

    // cacheControl: null preserves the pre-refactor behaviour of sending no Cache-Control.
    const url = await uploadToR2(key, buf, mime, { cacheControl: null });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Upload reference image:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
