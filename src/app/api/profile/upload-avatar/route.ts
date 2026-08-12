import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getR2, uploadToR2 } from "@/lib/r2";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

/** Sniffs the real file type from its leading bytes rather than trusting the client-supplied
 * extension/MIME type, which are just labels an uploader can set to anything. */
function detectImageType(buf: Buffer): "png" | "jpeg" | "webp" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
    }

    // Deliberately not R2_NOT_CONFIGURED_MESSAGE: this is the only public-facing R2 route, and
    // the shared message names our environment variables.
    if (!getR2()) {
      return NextResponse.json({ error: "Upload not configured. Contact support." }, { status: 503 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const detected = detectImageType(buf);
    if (!detected) {
      return NextResponse.json({ error: "File must be a PNG, JPEG, or WEBP image" }, { status: 400 });
    }
    const safeExt = detected === "jpeg" ? "jpg" : detected;
    const slug = session.email.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
    const key = `avatars/${slug}-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const mime = `image/${detected}`;

    const url = await uploadToR2(key, buf, mime, { cacheControl: null });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Profile avatar upload:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
