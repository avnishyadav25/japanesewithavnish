import { NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
    if (!r2 || !bucket || !bucketUrl) {
      return NextResponse.json(
        {
          error:
            "R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_BUCKET_URL.",
        },
        { status: 503 }
      );
    }

    if (!url.startsWith(`${bucketUrl}/`)) {
      return NextResponse.json({ error: "URL does not belong to configured bucket" }, { status: 400 });
    }

    const key = url.slice(bucketUrl.length + 1);
    if (!key) {
      return NextResponse.json({ error: "Invalid object key derived from URL" }, { status: 400 });
    }

    await r2.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete image:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete image" },
      { status: 500 }
    );
  }
}

