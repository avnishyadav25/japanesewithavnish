import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { R2_NOT_CONFIGURED_MESSAGE, getR2, uploadToR2 } from "@/lib/r2";

const MAX_TRACK_BYTES = 20 * 1024 * 1024; // 20MB — a 5-minute 128kbps MP3 is ~5MB

/** Sniffs the real container from the leading bytes rather than trusting the filename, matching
 * the approach in src/app/api/profile/upload-avatar/route.ts. */
function detectAudioType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  const ascii = (start: number, end: number) => buf.toString("ascii", start, end);

  if (ascii(0, 3) === "ID3") return { ext: "mp3", mime: "audio/mpeg" };
  // MPEG frame sync: 11 set bits.
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  if (ascii(0, 4) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  if (ascii(4, 8) === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (ascii(0, 4) === "fLaC") return { ext: "flac", mime: "audio/flac" };
  return null;
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const tracks = await sql`
    SELECT id, title, audio_url, duration_seconds, mood, license, attribution, source_url,
           default_gain_db, is_enabled, created_at::text AS created_at
    FROM video_bgm_tracks
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ tracks });
}

/**
 * Adds a track to the music library.
 *
 * `title` and `license` are enforced here, not just declared NOT NULL in the schema, because an
 * unattributed track is how a channel collects a copyright strike — and a strike is retroactive
 * across every video that used it. Recording provenance at upload time is the only moment it is
 * cheap to do.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  if (!getR2()) return NextResponse.json({ error: R2_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

  const file = form.get("file") as File | null;
  const title = String(form.get("title") ?? "").trim();
  const license = String(form.get("license") ?? "").trim();
  const attribution = String(form.get("attribution") ?? "").trim() || null;
  const mood = String(form.get("mood") ?? "").trim() || null;
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim() || null;
  const durationRaw = Number(form.get("durationSeconds"));
  const gainRaw = Number(form.get("defaultGainDb"));

  if (!file || !file.size) return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  if (file.size > MAX_TRACK_BYTES) {
    return NextResponse.json({ error: "Track must be 20MB or smaller" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  if (!license) {
    return NextResponse.json(
      { error: "A licence is required — record where this track came from and what it permits." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectAudioType(buf);
  if (!detected) {
    return NextResponse.json({ error: "File must be MP3, WAV, OGG, M4A or FLAC audio" }, { status: 400 });
  }

  const key = `video/bgm/${Date.now()}-${Math.random().toString(36).slice(2)}.${detected.ext}`;
  const audioUrl = await uploadToR2(key, buf, detected.mime);

  const rows = (await sql`
    INSERT INTO video_bgm_tracks
      (title, audio_url, duration_seconds, mood, license, attribution, source_url, default_gain_db)
    VALUES (${title}, ${audioUrl}, ${Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null},
            ${mood}, ${license}, ${attribution}, ${sourceUrl},
            ${Number.isFinite(gainRaw) ? gainRaw : -18})
    RETURNING id, title, audio_url, duration_seconds, mood, license, attribution, source_url,
              default_gain_db, is_enabled, created_at::text AS created_at
  `) as Record<string, unknown>[];

  return NextResponse.json({ track: rows[0] });
}
