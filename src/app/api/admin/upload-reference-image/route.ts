import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth/admin";

function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
    if (!r2 || !bucket || !bucketUrl) {
      return NextResponse.json(
        { error: "R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_BUCKET_URL." },
        { status: 503 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
    const key = `reference/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || (safeExt === "jpg" || safeExt === "jpeg" ? "image/jpeg" : "image/png");

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: mime,
      })
    );

    const url = `${bucketUrl}/${key}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Upload reference image:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
