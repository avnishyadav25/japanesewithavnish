import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { BGM_SEARCH_PRESETS, BGM_SOURCES, ccPermitsCommercial } from "@/lib/video/bgmCatalogue";

const JAMENDO_API = "https://api.jamendo.com/v3.0/tracks";

export interface SearchResult {
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  previewUrl: string;
  downloadUrl: string | null;
  license: string;
  licenseUrl: string | null;
  commercialUse: "allowed" | "not_allowed" | "unknown";
  requiresAttribution: boolean;
  sourceUrl: string;
}

/**
 * Searches Jamendo for importable tracks.
 *
 * Jamendo is the only one of the five sources with a usable music API. Pixabay's public API
 * covers images and video only — there is no music endpoint — and DOVA-SYNDROME has no API at
 * all, so both are download-then-import-by-URL. `GET` returns the source list and search
 * presets so the UI can say that plainly rather than offering a browser that cannot work.
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    sources: BGM_SOURCES,
    presets: BGM_SEARCH_PRESETS,
    jamendoConfigured: Boolean(process.env.JAMENDO_CLIENT_ID),
  });
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "JAMENDO_CLIENT_ID is not set. Register a free app at devportal.jamendo.com." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const query = String(body?.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "A search term is required" }, { status: 400 });

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "24",
    search: query,
    // Instrumental only: a vocal track fights the narration for the listener's attention, and
    // ducking cannot fix two voices talking at once.
    vocalinstrumental: "instrumental",
    // Only tracks we are actually allowed to download and re-host.
    audiodlformat: "mp32",
    include: "musicinfo+licenses",
    audioformat: "mp32",
  });

  try {
    const res = await fetch(`${JAMENDO_API}/?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return NextResponse.json({ error: `Jamendo returned ${res.status}` }, { status: 502 });

    const data = (await res.json()) as {
      headers?: { status?: string; error_message?: string };
      results?: Record<string, unknown>[];
    };
    if (data.headers?.status !== "success") {
      return NextResponse.json({ error: data.headers?.error_message ?? "Jamendo rejected the search" }, { status: 502 });
    }

    const results: SearchResult[] = (data.results ?? [])
      .filter((t) => t.audiodownload_allowed !== false)
      .map((t) => {
        const licenseUrl = (t.license_ccurl as string | null) ?? null;
        const commercialUse = ccPermitsCommercial(licenseUrl);
        return {
          externalId: String(t.id),
          title: String(t.name ?? "Untitled"),
          artist: String(t.artist_name ?? "Unknown"),
          durationSeconds: Number(t.duration ?? 0),
          previewUrl: String(t.audio ?? ""),
          downloadUrl: (t.audiodownload as string | null) ?? null,
          license: licenseUrl ? licenseUrl.replace(/^https?:\/\/creativecommons\.org\/licenses\//, "CC ").replace(/\/$/, "") : "Jamendo CC",
          licenseUrl,
          commercialUse,
          // Every Creative Commons licence except CC0 requires attribution.
          requiresAttribution: !licenseUrl?.includes("zero") && !licenseUrl?.includes("publicdomain"),
          sourceUrl: String(t.shareurl ?? `https://www.jamendo.com/track/${t.id}`),
        };
      })
      .filter((r) => r.downloadUrl);

    return NextResponse.json({
      results,
      // Surfaced in the UI as a warning per result — a -NC licence on a monetised channel is a
      // problem you find out about long after the video is published.
      note: results.some((r) => r.commercialUse !== "allowed")
        ? "Some results are non-commercial or unclear. Check the badge before importing if you monetise."
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Jamendo search failed (${err instanceof Error ? err.message : "unknown"})` },
      { status: 502 }
    );
  }
}
