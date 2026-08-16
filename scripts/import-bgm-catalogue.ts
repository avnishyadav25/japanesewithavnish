/**
 * Fills the background-music library in one run.
 *
 * The library has zero tracks. Jamendo search has been wired into the admin for a while and
 * JAMENDO_CLIENT_ID is set — nobody had ever imported anything, so every project's music picker
 * offered only "None", which reads as a broken feature rather than an empty one.
 *
 * Walks the presets already declared in src/lib/video/bgmCatalogue.ts rather than inventing a
 * second list of queries, so what this imports matches what the admin's search tab offers.
 *
 *   npm run bgm:import              pilot — prints what it would import, writes nothing
 *   npm run bgm:import -- --apply   downloads, uploads to R2, inserts
 *   npm run bgm:import -- --per=4   how many tracks per preset (default 3)
 *
 * LICENCE IS THE POINT. Only tracks Jamendo reports as commercially usable AND downloadable are
 * kept, and the licence url plus attribution are stored on every row — a claim applies
 * retroactively to every video that used the track, so an unattributed row is a liability.
 */
import { config as loadEnv } from "dotenv";
import { BGM_SEARCH_PRESETS, ccPermitsCommercial } from "../src/lib/video/bgmCatalogue";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  audiodownload: string;
  audiodownload_allowed: boolean;
  license_ccurl: string;
  shareurl: string;
  audio: string;
}

const API = "https://api.jamendo.com/v3.0/tracks";

async function search(query: string, limit: number): Promise<JamendoTrack[]> {
  const params = new URLSearchParams({
    client_id: process.env.JAMENDO_CLIENT_ID ?? "",
    format: "json",
    // Over-fetch hard. MEASURED: of 20 popular results for "koto japanese traditional", 19 were
    // by-nc-nd or by-nc-sa and exactly 1 permitted commercial use. Jamendo's own
    // license_cc=commercial filter is NOT a substitute — it surfaces tracks you may BUY a
    // commercial licence for, whose CC url is still NonCommercial. So: fetch a lot, verify every
    // one against the CC url, and accept a small yield rather than a licensing liability.
    limit: "150",
    search: query,
    // A vocal track fights the narration and ducking cannot fix two voices at once.
    vocalinstrumental: "instrumental",
    audiodlformat: "mp32",
    include: "musicinfo licenses",
    // Not popularity: the most popular tracks are overwhelmingly NonCommercial, so ordering by
    // popularity spends the whole page on results that will be rejected.
    order: "downloads_total",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Jamendo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: JamendoTrack[]; headers?: { error_message?: string } };
  if (json.headers?.error_message) throw new Error(json.headers.error_message);
  return json.results ?? [];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const perPreset = Number(process.argv.find((a) => a.startsWith("--per="))?.split("=")[1] ?? 3);

  if (!process.env.JAMENDO_CLIENT_ID) {
    throw new Error("JAMENDO_CLIENT_ID is not set. Register a free app at devportal.jamendo.com.");
  }

  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const db = sql;

  console.log(`${apply ? "APPLY" : "PILOT"} — ${BGM_SEARCH_PRESETS.length} presets, up to ${perPreset} tracks each\n`);

  const existing = (await db`SELECT external_id FROM video_bgm_tracks WHERE source = 'jamendo'`) as {
    external_id: string | null;
  }[];
  const seen = new Set(existing.map((r) => r.external_id).filter(Boolean) as string[]);

  let imported = 0;
  let skipped = 0;
  let rejected = 0;

  for (const preset of BGM_SEARCH_PRESETS) {
    console.log(`${preset.label}  (${preset.mood}) — ${preset.suits}`);
    let tracks: JamendoTrack[];
    try {
      tracks = await search(preset.query, perPreset);
    } catch (err) {
      console.log(`  ! search failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Jamendo rate-limits a burst of requests; a short pause costs nothing on an 8-preset run
    // and avoids the empty responses that look like "no usable tracks".
    await new Promise((r) => setTimeout(r, 400));

    let taken = 0;
    for (const t of tracks) {
      if (taken >= perPreset) break;

      const commercial = ccPermitsCommercial(t.license_ccurl);
      // "unknown" must never read as permission — the whole point of the three-state column.
      if (commercial !== "allowed" || t.audiodownload_allowed === false || !t.audiodownload) {
        rejected += 1;
        continue;
      }
      if (seen.has(String(t.id))) {
        skipped += 1;
        continue;
      }
      seen.add(String(t.id));
      taken += 1;

      const attribution = `${t.name} by ${t.artist_name} (Jamendo)`;
      console.log(`  ${apply ? "+" : "·"} ${t.name} — ${t.artist_name} · ${Math.round(t.duration)}s`);

      if (!apply) {
        imported += 1;
        continue;
      }

      try {
        // Downloaded and re-hosted rather than hot-linked: Jamendo urls expire and rotate, and a
        // dead audio url silently renders a video with no music bed at all.
        const res = await fetch(t.audiodownload);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 20 * 1024 * 1024) throw new Error(`too large (${Math.round(buf.length / 1e6)}MB)`);

        const { uploadToR2 } = await import("../src/lib/r2");
        const key = `video/bgm/jamendo-${t.id}.mp3`;
        const storedUrl = await uploadToR2(key, buf, "audio/mpeg");

        await db`
          INSERT INTO video_bgm_tracks
            (title, audio_url, duration_seconds, mood, license, attribution, source_url,
             default_gain_db, source, external_id, preview_url, is_instrumental,
             commercial_use, requires_attribution, is_enabled)
          VALUES (${t.name}, ${storedUrl}, ${Math.round(t.duration)}, ${preset.mood},
                  ${t.license_ccurl}, ${attribution}, ${t.shareurl},
                  -18, 'jamendo', ${String(t.id)}, ${t.audio ?? null}, true,
                  'allowed', true, true)
          -- idx_video_bgm_external is PARTIAL (WHERE external_id IS NOT NULL), so the predicate
          -- has to be restated here or Postgres cannot match the index and rejects the statement.
          ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
        `;
        imported += 1;
      } catch (err) {
        console.log(`    ! ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (taken === 0) console.log("    (nothing usable — every result was non-commercial or undownloadable)");
  }

  const total = (await db`SELECT COUNT(*)::int AS n FROM video_bgm_tracks WHERE is_enabled`) as { n: number }[];
  console.log(
    `\n${apply ? "Imported" : "Would import"} ${imported}· skipped ${skipped} already present · ` +
      `rejected ${rejected} on licence.\nLibrary now has ${total[0].n} enabled track(s).`
  );
  if (!apply) console.log("\nRe-run with --apply to actually import.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
