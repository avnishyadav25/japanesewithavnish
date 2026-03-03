import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

const SECONDS_PER_IMAGE = 3;
const FPS = 30;

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

function runFfmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const imageUrls = body.imageUrls as string[] | undefined;
    const secondsPerImage = typeof body.secondsPerImage === "number" && body.secondsPerImage > 0
      ? body.secondsPerImage
      : SECONDS_PER_IMAGE;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "imageUrls array required" }, { status: 400 });
    }

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");
    if (!r2 || !bucket || !bucketUrl) {
      return NextResponse.json(
        { error: "R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_BUCKET_URL." },
        { status: 503 }
      );
    }

    const tmpDir = path.join(os.tmpdir(), `reel-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      // Download images
      const ext = (url: string) => {
        const u = url.split("?")[0];
        if (u.endsWith(".png")) return "png";
        if (u.endsWith(".webp")) return "webp";
        return "jpg";
      };
      const localPaths: string[] = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch image ${i + 1}: ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(tmpDir, `img_${i}.${ext(url)}`);
        await fs.writeFile(filePath, buf);
        localPaths.push(filePath);
      }

      const outPath = path.join(tmpDir, "out.mp4");

      // Build ffmpeg: -loop 1 -t N -i img_0.png ... -filter_complex "[0:v][1:v]...concat=n=X:v=1:a=0[outv]" -map "[outv]" ...
      const inputArgs: string[] = [];
      for (const p of localPaths) {
        inputArgs.push("-loop", "1", "-t", String(secondsPerImage), "-i", path.basename(p));
      }
      const n = localPaths.length;
      const concatInputs = Array.from({ length: n }, (_, i) => `[${i}:v]`).join("");
      const filter = `${concatInputs}concat=n=${n}:v=1:a=0[outv]`;
      const ffmpegArgs = [
        ...inputArgs,
        "-filter_complex", filter,
        "-map", "[outv]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", String(FPS),
        "-y",
        "out.mp4",
      ];

      await runFfmpeg(ffmpegArgs, tmpDir);

      const videoBuf = await fs.readFile(outPath);
      const key = `reels/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: videoBuf,
          ContentType: "video/mp4",
        })
      );

      const videoUrl = `${bucketUrl}/${key}`;
      return NextResponse.json({ videoUrl });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg.includes("ffmpeg") || msg.includes("spawn")) {
      return NextResponse.json(
        { error: "Video creation failed. Ensure ffmpeg is installed (e.g. brew install ffmpeg) and on PATH." },
        { status: 503 }
      );
    }
    console.error("Create reel video:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
