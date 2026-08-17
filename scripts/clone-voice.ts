/**
 * Pre-generates cloned-voice narration into the shared TTS cache.
 *
 * THE SHAPE OF THIS, AND WHY.
 *
 * Chatterbox Multilingual (MIT, Hindi and English among 23 languages, zero-shot from ~10 s of
 * reference audio) needs a GPU. The render worker runs on CPU-only GitHub Actions runners, and
 * this Mac is an M1 with 8 GB, which is below the model's practical floor. So neither of the two
 * machines that render can also synthesize.
 *
 * The way out is that TTS is already cached by content hash in R2 and video_tts_assets. This
 * script runs anywhere with a GPU — a rented box by the hour — walks a storyboard's segments,
 * synthesizes the ones that are missing, and writes them into that cache under the SAME
 * `ttsHash(ssml, voiceName, rate, pitch)` key the renderer looks up. The renderer then finds
 * every clip already there and never loads a model.
 *
 * Because the key includes the voice name, a cloned segment can never be served Google audio by
 * accident, and re-running this costs nothing for lines that have not changed.
 *
 *   npm run voice:clone -- --storyboard=<uuid>            what would be generated
 *   npm run voice:clone -- --storyboard=<uuid> --queue    hand it to a free GPU notebook
 *   npm run voice:clone -- --storyboard=<uuid> --apply    generate now via CHATTERBOX_URL
 *   npm run voice:clone -- --storyboard=<uuid> --lang=en  only English segments
 *
 * TWO WAYS TO REACH A GPU. `--queue` writes the work list to video_voice_queue for
 * notebooks/clone-voice.ipynb to drain on Kaggle or Colab — free, and the only option that works
 * on Kaggle, which cannot expose an inbound HTTP server. `--apply` posts to CHATTERBOX_URL and
 * suits a rented box you control. Both end in the same cache.
 *
 * WHAT YOU HAVE TO DO FIRST
 *   1. Record ~60 s of clean speech per language. One mic, quiet room, no music, no processing.
 *      Save as reference/avnish-en.wav and reference/avnish-hi.wav.
 *   2. On a GPU box: pip install chatterbox-tts, and set CHATTERBOX_URL to a small HTTP wrapper
 *      around it (the script posts {text, reference, language} and expects WAV bytes back).
 *   3. Point the project's voices at cloned:avnish-en / cloned:avnish-hi.
 *
 * Japanese is deliberately NOT clonable here. A voice cloned from English or Hindi reference
 * audio reading Japanese produces confident mispronunciation, which is the single worst failure
 * mode for a teaching video — ja segments keep the native Google voice.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

interface Segment {
  id: string;
  text: string;
  lang: string;
  ssml?: string;
  voice?: string;
  speakingRate?: number;
  pitch?: number;
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

/**
 * Calls the GPU box. Deliberately a plain HTTP contract rather than a Python binding: the model
 * cannot run in this process on any machine that renders, so an in-process API would be a lie.
 */
async function synthesizeCloned(text: string, voiceName: string, lang: string): Promise<Buffer> {
  const base = process.env.CHATTERBOX_URL;
  if (!base) {
    throw new Error(
      "CHATTERBOX_URL is not set. This step needs a GPU box running a Chatterbox HTTP wrapper; " +
        "an M1/8GB cannot host the model."
    );
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: lang,
      // The reference clip is named by the voice, so cloned:avnish-en -> avnish-en.wav.
      reference: voiceName.replace(/^cloned:/, ""),
    }),
  });
  if (!res.ok) throw new Error(`Chatterbox ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`Chatterbox returned ${buf.length} bytes — not audio`);
  return buf;
}

async function main() {
  const storyboardId = arg("storyboard");
  const onlyLang = arg("lang");
  const apply = process.argv.includes("--apply");
  const queue = process.argv.includes("--queue");
  if (!storyboardId) throw new Error("Pass --storyboard=<uuid>");

  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");
  const db = sql;

  const { ttsHash, buildSsml, voiceForSegment } = await import("../src/lib/video/tts");
  const { isClonedVoice } = await import("../src/lib/video/ttsProvider");

  const rows = (await db`
    SELECT s.doc, p.voices FROM video_storyboards s
    JOIN video_projects p ON p.id = s.project_id
    WHERE s.id = ${storyboardId}::uuid
  `) as { doc: { scenes?: { narration?: Segment[] }[] }; voices: Record<string, string> | null }[];
  if (!rows[0]) throw new Error("Storyboard not found");

  const segments = (rows[0].doc.scenes ?? []).flatMap((s) => s.narration ?? []);
  const projectVoices = rows[0].voices ?? {};

  const mode = queue ? "QUEUE" : apply ? "APPLY" : "PILOT";
  console.log(`${mode} — ${segments.length} segment(s) in this storyboard\n`);

  let cloned = 0;
  let cached = 0;
  let skipped = 0;
  let generated = 0;
  let queued = 0;
  let alreadyQueued = 0;

  for (const segment of segments) {
    if (!segment.text?.trim()) continue;
    if (onlyLang && segment.lang !== onlyLang) continue;

    const voiceName = voiceForSegment(segment as never, projectVoices as never);
    if (!isClonedVoice(voiceName)) {
      skipped += 1;
      continue;
    }
    cloned += 1;

    const ssml = segment.ssml ?? buildSsml(segment as never);
    const req = {
      ssml,
      voiceName,
      speakingRate: segment.speakingRate ?? 1.0,
      pitch: segment.pitch ?? 0,
    };
    const hash = ttsHash(req);

    // Exactly the lookup the renderer does. A hit means this line is already paid for.
    const hit = (await db`SELECT id FROM video_tts_assets WHERE text_hash = ${hash} LIMIT 1`) as { id: string }[];
    if (hit[0]) {
      cached += 1;
      continue;
    }

    console.log(`  ${apply || queue ? "+" : "·"} ${segment.lang} ${segment.id}  ${segment.text.slice(0, 60)}`);

    // ---- queue mode: hand the work to an external GPU -----------------------
    //
    // The hash is written here, by the same ttsHash() the renderer looks up with, and never
    // recomputed on the GPU side. JS renders `${1.0}` as "1" and Python's f"{1.0}" gives "1.0",
    // so a notebook deriving its own key would miss the cache on every clip — silently, because
    // a missing entry just means "synthesize it", and the renderer would fall back to Google.
    if (queue) {
      // RETURNING, so the count reflects what was actually inserted rather than what was
      // attempted. Without it a second run reports "13 queued" having queued nothing, which is
      // the number you would act on.
      const inserted = (await db`
        INSERT INTO video_voice_queue
          (storyboard_id, text_hash, segment_id, text, ssml, lang, voice_name, speaking_rate, pitch)
        VALUES (${storyboardId}::uuid, ${hash}, ${segment.id}, ${segment.text}, ${ssml},
                ${segment.lang}, ${voiceName}, ${req.speakingRate}, ${req.pitch})
        ON CONFLICT (text_hash) DO NOTHING
        RETURNING id
      `) as { id: string }[];
      if (inserted.length > 0) queued += 1;
      else alreadyQueued += 1;
      continue;
    }

    if (!apply) {
      generated += 1;
      continue;
    }

    const audio = await synthesizeCloned(segment.text, voiceName, segment.lang);
    const { uploadToR2 } = await import("../src/lib/r2");
    const url = await uploadToR2(`video/tts/${hash}.wav`, audio, "audio/wav");

    // Duration is read from the RIFF header by the same parser the renderer uses, so a cloned
    // clip and a Google one are measured identically — every downstream frame span depends on it.
    const { wavDurationSeconds } = await import("../src/lib/video/tts");
    const durationSeconds = wavDurationSeconds(audio);

    await db`
      INSERT INTO video_tts_assets
        (text_hash, lang_code, voice_name, speaking_rate, pitch, text_preview, audio_url,
         duration_seconds, char_count, estimated_cost_usd)
      VALUES (${hash}, ${segment.lang}, ${voiceName}, ${req.speakingRate}, ${req.pitch},
              ${segment.text.slice(0, 200)}, ${url}, ${durationSeconds}, ${segment.text.length}, 0)
      ON CONFLICT (text_hash) DO NOTHING
    `;
    generated += 1;
  }

  if (queue) {
    const pending = (await db`
      SELECT COUNT(*)::int AS n FROM video_voice_queue WHERE status = 'pending'
    `) as { n: number }[];
    console.log(
      `\n${cloned} cloned-voice segment(s): ${cached} already cached, ${queued} newly queued` +
        `${alreadyQueued > 0 ? `, ${alreadyQueued} already queued` : ""}. ` +
        `${skipped} left to Google.\n` +
        `${pending[0].n} line(s) now pending across all storyboards.\n\n` +
        `Next: open notebooks/clone-voice.ipynb on Kaggle or Colab and run it.\n` +
        `See docs/VIDEO_MANUAL_STEPS.md for the free-GPU walkthrough.`
    );
    return;
  }

  console.log(
    `\n${cloned} cloned-voice segment(s): ${cached} already cached, ` +
      `${generated} ${apply ? "generated" : "would be generated"}. ` +
      `${skipped} left to Google.`
  );
  if (!apply && generated > 0) {
    console.log("\nEither: --queue to send them to a free GPU notebook (see docs/VIDEO_MANUAL_STEPS.md),");
    console.log("or:     --apply with CHATTERBOX_URL set, if you have a box running.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
