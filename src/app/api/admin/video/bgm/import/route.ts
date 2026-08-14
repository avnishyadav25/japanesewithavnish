import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { R2_NOT_CONFIGURED_MESSAGE, getR2, uploadToR2 } from "@/lib/r2";
import { ccPermitsCommercial } from "@/lib/video/bgmCatalogue";

const MAX_TRACK_BYTES = 20 * 1024 * 1024;
/** Fetching an arbitrary URL from a server is a small SSRF surface; only real audio hosts on
 * https, and only files that actually sniff as audio, ever land in the bucket. */
const FETCH_TIMEOUT_MS = 25_000;

function detectAudioType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  const ascii = (a: number, b: number) => buf.toString("ascii", a, b);
  if (ascii(0, 3) === "ID3") return { ext: "mp3", mime: "audio/mpeg" };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  if (ascii(0, 4) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  if (ascii(4, 8) === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (ascii(0, 4) === "fLaC") return { ext: "flac", mime: "audio/flac" };
  return null;
}

/** Blocks the obvious SSRF targets. Not a complete defence, but this endpoint is admin-only and
 * the output must be a valid audio file, which rules out almost everything interesting. */
function isFetchableUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false; // no raw IPs, so no link-local/metadata
    return true;
  } catch {
    return false;
  }
}

/**
 * Imports a track from a URL.
 *
 * Serves both the manual route (download from DOVA-SYNDROME or Pixabay, paste the link) and the
 * Jamendo browser, which posts the track's `audiodownload` URL along with its licence metadata.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  if (!getR2()) return NextResponse.json({ error: R2_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const audioUrl = String(body?.audioUrl ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const license = String(body?.license ?? "").trim();
  const source = ["curated", "url_import", "pixabay", "jamendo"].includes(body?.source)
    ? (body.source as string)
    : "url_import";

  if (!isFetchableUrl(audioUrl)) {
    return NextResponse.json({ error: "Provide an https:// URL to an audio file" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  if (!license) {
    return NextResponse.json(
      { error: "A licence is required — record where this came from and what it permits." },
      { status: 400 }
    );
  }

  // Same external track twice from the same provider is the same row.
  const externalId = typeof body?.externalId === "string" ? body.externalId : null;
  if (externalId) {
    const existing = (await sql`
      SELECT id FROM video_bgm_tracks WHERE source = ${source} AND external_id = ${externalId}
    `) as { id: string }[];
    if (existing[0]) {
      return NextResponse.json({ error: "That track is already in the library.", trackId: existing[0].id }, { status: 409 });
    }
  }

  let buf: Buffer;
  try {
    const res = await fetch(audioUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "japanesewithavnish-video-studio" },
    });
    if (!res.ok) return NextResponse.json({ error: `Source returned ${res.status}` }, { status: 400 });

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_TRACK_BYTES) {
      return NextResponse.json({ error: "Track is larger than 20MB" }, { status: 400 });
    }
    buf = Buffer.from(await res.arrayBuffer());
    // Re-check after download: content-length can be absent or lie.
    if (buf.length > MAX_TRACK_BYTES) {
      return NextResponse.json({ error: "Track is larger than 20MB" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Could not fetch that URL (${err instanceof Error ? err.message : "unknown"})` },
      { status: 400 }
    );
  }

  const detected = detectAudioType(buf);
  if (!detected) {
    return NextResponse.json(
      { error: "That URL did not return audio. Link directly to the MP3, not to the page it sits on." },
      { status: 400 }
    );
  }

  const key = `video/bgm/${Date.now()}-${Math.random().toString(36).slice(2)}.${detected.ext}`;
  const storedUrl = await uploadToR2(key, buf, detected.mime);

  // Commercial-use status is three-state on purpose: "unknown" must never read as permission.
  const commercialUse =
    body?.licenseUrl && ccPermitsCommercial(String(body.licenseUrl)) !== "unknown"
      ? ccPermitsCommercial(String(body.licenseUrl))
      : ["allowed", "not_allowed"].includes(body?.commercialUse)
        ? body.commercialUse
        : "unknown";

  const rows = (await sql`
    INSERT INTO video_bgm_tracks
      (title, audio_url, duration_seconds, mood, license, attribution, source_url, default_gain_db,
       source, external_id, preview_url, commercial_use, requires_attribution)
    VALUES (${title}, ${storedUrl},
            ${Number.isFinite(Number(body?.durationSeconds)) && Number(body.durationSeconds) > 0 ? Number(body.durationSeconds) : null},
            ${String(body?.mood ?? "").trim() || null}, ${license},
            ${String(body?.attribution ?? "").trim() || null},
            ${String(body?.sourceUrl ?? audioUrl).trim()},
            ${Number.isFinite(Number(body?.defaultGainDb)) ? Number(body.defaultGainDb) : -18},
            ${source}, ${externalId}, ${String(body?.previewUrl ?? "").trim() || null},
            ${commercialUse}, ${body?.requiresAttribution === true})
    RETURNING id, title, audio_url, duration_seconds, mood, license, attribution, source_url,
              default_gain_db, is_enabled, source, commercial_use, requires_attribution,
              created_at::text AS created_at
  `) as Record<string, unknown>[];

  return NextResponse.json({ track: rows[0] });
}
