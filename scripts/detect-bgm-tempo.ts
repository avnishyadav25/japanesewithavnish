/**
 * Measures the tempo of every BGM track so a Shorts cut can land on a beat.
 *
 * WHY THIS IS NEEDED. `video_bgm_tracks` has carried `loop_point_seconds` since migration 134 and
 * nothing has ever read it; tempo was absent entirely. Without a BPM the video and the music are
 * completely independent — the only interaction in the whole pipeline is one-directional, caption
 * cues ducking the music gain in VideoRoot. Music never influenced a cut.
 *
 * HOW. Decode to mono 22.05kHz PCM with ffmpeg, build an onset-strength envelope from the
 * frame-to-frame rise in energy, then autocorrelate that envelope and take the strongest lag in
 * the 60-180 BPM range. This is the standard cheap approach and it is accurate enough for the job:
 * quantisation only shifts a cut by up to ~150ms, so a tempo that is a few BPM out still lands
 * closer to the beat than no quantisation at all.
 *
 * Rectified difference, not raw energy — the rise matters, not the level. A track with a loud
 * sustained pad has high energy throughout and no onsets; taking the positive difference is what
 * separates "loud" from "a note just started".
 *
 * HALF/DOUBLE TEMPO is the classic failure: an autocorrelation peak at 75 BPM is equally strong at
 * 150. Resolved by preferring the octave nearest 100 BPM, which is where most of this catalogue
 * sits, and by recording a confidence so a poor estimate can be ignored rather than trusted.
 *
 * Usage:
 *   npx tsx scripts/detect-bgm-tempo.ts            # every track missing a bpm
 *   npx tsx scripts/detect-bgm-tempo.ts --all      # re-measure everything
 *   npx tsx scripts/detect-bgm-tempo.ts --dry-run
 */
import { config } from "dotenv";
import { spawn } from "child_process";
import { neon } from "@neondatabase/serverless";

config({ path: ".env" });

const SAMPLE_RATE = 22050;
const HOP = 512;                       // ~23ms per frame — fine enough for 180 BPM (333ms apart)
const MIN_BPM = 60;
const MAX_BPM = 180;
/** Only the first minute is analysed: tempo is constant in this catalogue and decoding a whole
 *  six-minute ambient track to measure it wastes most of the run. */
const ANALYSE_SECONDS = 60;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const sql = neon(process.env.DATABASE_URL);

/** Decodes a remote audio URL to raw mono float-friendly PCM via ffmpeg's stdout. */
async function decodePcm(url: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", url,
      "-t", String(ANALYSE_SECONDS),
      "-ac", "1",
      "-ar", String(SAMPLE_RATE),
      "-f", "s16le",
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    let err = "";
    ff.stdout.on("data", (c: Buffer) => chunks.push(c));
    ff.stderr.on("data", (c: Buffer) => { err += c.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${err.slice(0, 300)}`));
      const buf = Buffer.concat(chunks);
      const out = new Int16Array(buf.length >> 1);
      for (let i = 0; i < out.length; i += 1) out[i] = buf.readInt16LE(i * 2);
      resolve(out);
    });
  });
}

/** Positive frame-to-frame change in RMS: high where a note starts, ~0 through a sustained pad. */
function onsetEnvelope(pcm: Int16Array): number[] {
  const frames = Math.floor(pcm.length / HOP);
  const rms: number[] = new Array(frames);
  for (let f = 0; f < frames; f += 1) {
    let sum = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i += 1) sum += pcm[i] * pcm[i];
    rms[f] = Math.sqrt(sum / HOP);
  }
  const env: number[] = new Array(Math.max(0, frames - 1));
  for (let f = 1; f < frames; f += 1) env[f - 1] = Math.max(0, rms[f] - rms[f - 1]);
  // Mean-removed, so autocorrelation measures periodicity rather than the DC level.
  const mean = env.reduce((a, b) => a + b, 0) / (env.length || 1);
  return env.map((v) => v - mean);
}

function detectBpm(env: number[]): { bpm: number; confidence: number; offsetSeconds: number } | null {
  if (env.length < 200) return null;
  const framesPerSecond = SAMPLE_RATE / HOP;
  const minLag = Math.floor((60 / MAX_BPM) * framesPerSecond);
  const maxLag = Math.ceil((60 / MIN_BPM) * framesPerSecond);

  const energy = env.reduce((a, b) => a + b * b, 0);
  if (energy <= 0) return null;

  let bestLag = 0;
  let bestScore = 0;
  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < env.length; i += 1) sum += env[i] * env[i + lag];
    const score = sum / energy;
    scores.push(score);
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (bestLag === 0) return null;

  let bpm = (60 * framesPerSecond) / bestLag;
  // Octave correction — 75 and 150 BPM are indistinguishable to autocorrelation.
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  // Confidence: the winning peak against the median score. A track with no pulse scores flat, so
  // the ratio sits near 1; a strong beat stands well clear of its neighbours.
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1e-9;
  const confidence = Math.max(0, Math.min(1, (bestScore / Math.abs(median) - 1) / 4));

  // Where the first beat falls, so the grid is phase-aligned rather than assuming a beat at t=0.
  const period = bestLag;
  let peakFrame = 0;
  let peakVal = -Infinity;
  for (let f = 0; f < Math.min(period, env.length); f += 1) {
    if (env[f] > peakVal) { peakVal = env[f]; peakFrame = f; }
  }

  return { bpm, confidence, offsetSeconds: peakFrame / framesPerSecond };
}

async function main() {
  const all = process.argv.includes("--all");
  const dryRun = process.argv.includes("--dry-run");

  const tracks = (await sql`
    SELECT id, title, audio_url, mood, bpm
    FROM video_bgm_tracks
    WHERE is_enabled AND audio_url IS NOT NULL
    ORDER BY title
  `) as { id: string; title: string; audio_url: string; mood: string | null; bpm: string | null }[];

  const todo = all ? tracks : tracks.filter((t) => t.bpm === null);
  console.log(`${tracks.length} enabled track(s); measuring ${todo.length}${dryRun ? " (dry run)" : ""}\n`);

  let ok = 0;
  let unusable = 0;
  for (const track of todo) {
    process.stdout.write(`  ${track.title.slice(0, 44).padEnd(46)}`);
    try {
      const result = detectBpm(onsetEnvelope(await decodePcm(track.audio_url)));
      if (!result) { console.log("no pulse detected — left null"); unusable += 1; continue; }
      const { bpm, confidence, offsetSeconds } = result;
      console.log(`${bpm.toFixed(1)} BPM  conf ${confidence.toFixed(2)}  offset ${offsetSeconds.toFixed(3)}s${confidence < 0.35 ? "  (below the quantisation threshold)" : ""}`);
      if (!dryRun) {
        await sql`
          UPDATE video_bgm_tracks
          SET bpm = ${bpm.toFixed(2)}, bpm_confidence = ${confidence.toFixed(3)},
              beat_offset_seconds = ${offsetSeconds.toFixed(3)}
          WHERE id = ${track.id}::uuid
        `;
      }
      ok += 1;
      if (confidence < 0.35) unusable += 1;
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message.slice(0, 90)}`);
    }
  }

  // Reported explicitly rather than left implicit: a silent "12 of 19 measured" reads as full
  // coverage when a third of the catalogue will never quantise.
  console.log(`\n${ok} measured, ${unusable} not usable for quantisation (free-tempo or low confidence).`);
  console.log("Tracks without a usable BPM still play — they simply do not move any cut.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
