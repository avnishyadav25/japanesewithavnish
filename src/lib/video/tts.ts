/**
 * Video Studio — Google Cloud Text-to-Speech narration.
 *
 * Auth mirrors src/lib/google-sheets-export.ts (jose-signed service-account JWT exchanged for
 * an access token) so there is one Google auth idiom in the codebase, not two.
 *
 * Deliberately DB-agnostic: the cache is injected as a `TtsCache`, because this module runs
 * both inside Next (where the `sql` proxy is available) and inside the render worker (which
 * holds its own Neon client and cannot import `@/lib/db`). Nothing here imports `next/*`.
 *
 * Output is LINEAR16 WAV, not MP3, on purpose. Scene timing, caption cues, and frame spans are
 * all derived from narration length, so duration has to be exact — a WAV header gives it
 * arithmetically (`dataBytes / (sampleRate * channels * bytesPerSample)`) with no ffprobe
 * round-trip and no VBR estimation error. The mux to AAC happens once, at the end.
 */
import { createHash } from "crypto";
import { SignJWT, importPKCS8 } from "jose";
// Relative, not "@/lib/r2", on purpose: scripts/video-worker.ts imports this module by path
// under plain tsx, which resolves relative specifiers but not Next's "@/" tsconfig alias.
// Same reason for "./types" below. Everything else in src/ keeps the house "@/" convention.
import { uploadToR2 } from "../r2";
import { languageCodeFromVoice, supportsSsml } from "./voices";
// Relative for the same reason as ../r2 above: the worker imports this module by path.
import { providerForVoice } from "./ttsProvider";
import type { NarrationLang, NarrationSegment, WordTiming } from "./types";

const TTS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// v1beta1, not v1, for ONE reason: `enableTimePointing` exists only on the beta endpoint, and v1
// ignores the field silently rather than erroring — so a v1 request looks like it worked and
// simply returns no timepoints. Everything else about the two endpoints is identical for our
// usage, and the response shape for `audioContent` is unchanged.
const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

/** Google caps a single synthesize request at 5000 bytes of input, markup included. We chunk
 * well under it so SSML wrapper tags can never push a chunk over. */
const MAX_INPUT_BYTES = 3500;
const SAMPLE_RATE = 24000;

export const DEFAULT_VOICES: Record<NarrationLang, string> = {
  en: "en-US-Neural2-F",
  hi: "hi-IN-Neural2-A",
  // Indian English, not a Hindi voice: Hinglish is written in Latin script and a hi-IN voice
  // would apply Hindi phonetics to it.
  hinglish: "en-IN-Neural2-A",
  ja: "ja-JP-Neural2-B",
};

/** Every Japanese term is spoken by a native voice regardless of the narration language. */
export const JAPANESE_VOICE = "ja-JP-Neural2-B";

/** USD per 1M characters, by voice tier. Estimates for the estimated_cost_usd column, not a
 * source of billing truth — update if Google's published pricing changes. */
const PRICE_PER_MILLION_CHARS: Record<string, number> = {
  Standard: 4,
  Wavenet: 16,
  Neural2: 16,
  Polyglot: 16,
  Studio: 160,
  Chirp: 30,
};

/** Mirrors the fallback that `getAccessToken()` below actually performs. Checking only the
 * GOOGLE_TTS_* pair would report "not configured" for a setup that works perfectly well off the
 * Sheets service account, which is the documented shortcut in .env.example. */
export function ttsConfigured(): boolean {
  const email = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const key =
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;
  return Boolean(email && key);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Falls back to the Sheets service account so a single GCP project with both APIs enabled
  // works without duplicating the key into a second pair of env vars.
  const email =
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const rawKey =
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Google TTS not configured. Set GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL and GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY (or reuse the Sheets service account with the Cloud Text-to-Speech API enabled)."
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  // Service-account private keys stored in env vars typically have literal "\n" escapes.
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
  const jwt = await new SignJWT({ scope: TTS_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// SSML
// ---------------------------------------------------------------------------

export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds the SSML actually sent to Google.
 *
 * `spokenAs` is where the pronunciation correctness comes from: Google's ja-JP voices guess
 * between readings of the same kanji (行った is いった or おこなった depending on context), and
 * they guess wrong often enough to be embarrassing in a language-teaching video. Our sidecar
 * tables already hold the answer, so the storyboard builder puts the kana reading in
 * `spokenAs` and the voice never has to guess. Captions still show `text`.
 */
export function buildSsml(segment: Pick<NarrationSegment, "text" | "spokenAs" | "leadInSeconds">): string {
  const spoken = escapeSsml(segment.spokenAs?.trim() || segment.text.trim());
  const lead = segment.leadInSeconds && segment.leadInSeconds > 0
    ? `<break time="${Math.round(segment.leadInSeconds * 1000)}ms"/>`
    : "";
  return `<speak>${lead}${spoken}</speak>`;
}

/**
 * Wraps every word in a zero-duration `<mark>` so Google reports when it is spoken.
 *
 * CRITICAL: the result of this function must NEVER reach `ttsHash`. The cache key is
 * sha256(ssml + voice + rate + pitch), so marking the SSML would change the key for every clip
 * already cached and re-bill the entire library on the next render. Marks change no audio sample;
 * they are a request-time decoration only.
 *
 * Returns `null` when marking is not worth doing, and the caller then sends the plain SSML:
 *   - Japanese has no whitespace, so splitting on it yields one "word" and no useful timing. The
 *     caption for a Japanese segment is a single phrase anyway.
 *   - A single-word segment gains nothing from a highlight that covers the whole line.
 */
function markedSsml(ssml: string, lang: NarrationLang): { ssml: string; words: string[] } | null {
  if (lang === "ja") return null;
  const open = ssml.indexOf("<speak>");
  const close = ssml.lastIndexOf("</speak>");
  if (open !== 0 || close < 0) return null;
  const inner = ssml.slice(7, close);

  // Preserve a leading <break/> exactly as-is — it is what produces leadInSeconds, and marking
  // inside it would corrupt the tag.
  const breakMatch = /^<break time="\d+ms"\/>/.exec(inner);
  const lead = breakMatch ? breakMatch[0] : "";
  const body = inner.slice(lead.length);
  if (body.includes("<")) return null; // any other markup: not worth the risk of malforming it

  const words = body.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const marked = words.map((w, i) => `<mark name="w${i}"/>${w}`).join(" ");
  return { ssml: `<speak>${lead}${marked}</speak>`, words };
}

function priceTierFromVoice(voiceName: string): number {
  for (const [tier, price] of Object.entries(PRICE_PER_MILLION_CHARS)) {
    if (voiceName.includes(tier)) return price;
  }
  return PRICE_PER_MILLION_CHARS.Neural2;
}

/** Splits SSML-free text on sentence boundaries so each chunk stays under Google's input cap.
 * Japanese sentence enders are included alongside ASCII ones — the same boundary set the
 * existing practice-test TTS chunker uses. */
export function chunkText(text: string, maxBytes = MAX_INPUT_BYTES): string[] {
  const trimmed = text.trim();
  if (Buffer.byteLength(trimmed, "utf8") <= maxBytes) return [trimmed];

  const pieces = trimmed.split(/(?<=[。！？.!?\n])/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current + piece;
    if (Buffer.byteLength(candidate, "utf8") > maxBytes && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // A single sentence longer than the cap still has to be broken somewhere; fall back to a
  // hard character split rather than throwing.
  return chunks.flatMap((chunk) =>
    Buffer.byteLength(chunk, "utf8") <= maxBytes ? [chunk] : hardSplit(chunk, maxBytes)
  );
}

function hardSplit(text: string, maxBytes: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const char of Array.from(text)) {
    if (Buffer.byteLength(current + char, "utf8") > maxBytes) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) out.push(current);
  return out;
}

// ---------------------------------------------------------------------------
// WAV
// ---------------------------------------------------------------------------

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

/** Walks RIFF chunks rather than assuming a fixed 44-byte header — Google sometimes emits a
 * LIST/INFO chunk before `data`, and a hardcoded offset would splice metadata into the audio. */
export function parseWav(buf: Buffer): WavInfo {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE buffer");
  }
  let offset = 12;
  let sampleRate = SAMPLE_RATE;
  let channels = 1;
  let bitsPerSample = 16;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunkId === "fmt ") {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bitsPerSample = buf.readUInt16LE(body + 14);
    } else if (chunkId === "data") {
      return { sampleRate, channels, bitsPerSample, dataOffset: body, dataLength: Math.min(chunkSize, buf.length - body) };
    }
    // Chunks are word-aligned: an odd size is followed by a pad byte.
    offset = body + chunkSize + (chunkSize % 2);
  }
  throw new Error("WAV data chunk not found");
}

export function wavDurationSeconds(buf: Buffer): number {
  const info = parseWav(buf);
  const bytesPerFrame = info.channels * (info.bitsPerSample / 8);
  if (bytesPerFrame === 0) return 0;
  return info.dataLength / (info.sampleRate * bytesPerFrame);
}

function buildWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);            // PCM fmt chunk size
  header.writeUInt16LE(1, 20);             // audioFormat = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);
  return header;
}

/** Concatenates chunk WAVs into one by stripping every header and rewriting a single one. */
export function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) throw new Error("concatWav called with no buffers");
  if (buffers.length === 1) return buffers[0];
  const infos = buffers.map(parseWav);
  const first = infos[0];
  const pcm = buffers.map((buf, i) => buf.subarray(infos[i].dataOffset, infos[i].dataOffset + infos[i].dataLength));
  const data = Buffer.concat(pcm);
  return Buffer.concat([buildWavHeader(data.length, first.sampleRate, first.channels, first.bitsPerSample), data]);
}

/** N seconds of digital silence, used for `leadInSeconds` gaps and end-of-scene padding. */
export function silentWav(seconds: number, sampleRate = SAMPLE_RATE, channels = 1): Buffer {
  const frames = Math.max(0, Math.round(seconds * sampleRate));
  const data = Buffer.alloc(frames * channels * 2);
  return Buffer.concat([buildWavHeader(data.length, sampleRate, channels, 16), data]);
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export interface SynthesisRequest {
  ssml: string;
  voiceName: string;
  /** Only used to decide whether word marks are worth inserting; never part of the cache key. */
  lang?: NarrationLang;
  speakingRate: number;
  pitch: number;
}

export interface SynthesizedAudio {
  buffer: Buffer;
  durationSeconds: number;
  charCount: number;
  estimatedCostUsd: number;
  words?: WordTiming[];
}

/** Content hash for the cache. Everything that would change a single output sample is in it. */
export function ttsHash(req: SynthesisRequest): string {
  return createHash("sha256")
    .update(`${req.ssml} ${req.voiceName} ${req.speakingRate} ${req.pitch}`)
    .digest("hex");
}

async function synthesizeChunk(
  ssml: string,
  req: SynthesisRequest,
  wantTimepoints = false
): Promise<{ buffer: Buffer; timepoints: { markName: string; timeSeconds: number }[] }> {
  const token = await getAccessToken();

  // Chirp 3: HD voices reject SSML — they take plain text only. Sending markup to one gets the
  // angle brackets read out loud. Our pauses are timeline gaps rather than <break> tags, so
  // stripping the wrapper loses nothing.
  const input = supportsSsml(req.voiceName)
    ? { ssml }
    : { text: ssml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };

  const res = await fetch(SYNTHESIZE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      ...(wantTimepoints ? { enableTimePointing: ["SSML_MARK"] } : {}),
      voice: { languageCode: languageCodeFromVoice(req.voiceName), name: req.voiceName },
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: SAMPLE_RATE,
        speakingRate: req.speakingRate,
        pitch: req.pitch,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Google TTS synthesize failed: ${res.status} ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    audioContent?: string;
    timepoints?: { markName?: string; timeSeconds?: number }[];
  };
  if (!data.audioContent) throw new Error("Google TTS returned no audioContent");
  return {
    buffer: Buffer.from(data.audioContent, "base64"),
    timepoints: (data.timepoints ?? [])
      .filter((t): t is { markName: string; timeSeconds: number } =>
        typeof t.markName === "string" && typeof t.timeSeconds === "number")
      .map((t) => ({ markName: t.markName, timeSeconds: t.timeSeconds })),
  };
}

/**
 * Synthesizes one request, chunking if it exceeds Google's input cap. No caching, no upload —
 * `resolveNarrationAudio` layers those on top.
 *
 * Dispatches to a registered provider when one claims the voice name, so a cloned voice can be
 * produced by a different engine without any caller changing. Nothing is registered by default,
 * so the Google path below is what runs unless something opts in.
 */
export async function synthesize(req: SynthesisRequest): Promise<SynthesizedAudio> {
  const provider = providerForVoice(req.voiceName);
  if (provider) {
    if (!provider.configured()) {
      throw new Error(
        `Voice "${req.voiceName}" needs the ${provider.id} provider, which is not configured on this machine. ` +
          `Pre-generate that audio where it is (see scripts/clone-voice.ts) — the render then hits the cache.`
      );
    }
    return provider.synthesize(req);
  }

  const inner = req.ssml.replace(/^<speak>/, "").replace(/<\/speak>$/, "");
  const needsChunking = Buffer.byteLength(req.ssml, "utf8") > MAX_INPUT_BYTES;

  // Marks are only sent when the voice accepts SSML at all — Chirp3-HD gets its markup stripped to
  // plain text by synthesizeChunk, and sending marks there would put the literal tags into the
  // spoken line.
  const marks = req.lang && supportsSsml(req.voiceName) ? markedSsml(req.ssml, req.lang) : null;

  const buffers: Buffer[] = [];
  const words: WordTiming[] = [];
  if (!needsChunking) {
    const out = await synthesizeChunk(marks?.ssml ?? req.ssml, req, Boolean(marks));
    buffers.push(out.buffer);
    if (marks) {
      for (const tp of out.timepoints) {
        const i = Number(tp.markName.slice(1));
        if (Number.isInteger(i) && marks.words[i]) words.push({ text: marks.words[i], start: tp.timeSeconds });
      }
    }
  } else {
    // Chunked requests get no word timings. Each chunk is a separate synthesis whose timepoints
    // restart at zero, and the marks would have to be re-indexed against a split this function
    // performs on plain text rather than on the marked string. A cue that long is a lesson
    // paragraph, not a Shorts beat, so the estimator covers it.
    for (const chunk of chunkText(inner)) {
      buffers.push((await synthesizeChunk(`<speak>${chunk}</speak>`, req)).buffer);
      // Google's per-project QPS is generous but not unlimited; the existing practice-test
      // chunker paces at 150ms and has never been rate-limited.
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const buffer = concatWav(buffers);
  const charCount = inner.replace(/<[^>]+>/g, "").length;
  return {
    buffer,
    durationSeconds: wavDurationSeconds(buffer),
    charCount,
    estimatedCostUsd: (charCount / 1_000_000) * priceTierFromVoice(req.voiceName),
    words: words.length > 0 ? words.sort((a, b) => a.start - b.start) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Cache-backed resolution
// ---------------------------------------------------------------------------

export interface CachedTts {
  id: string;
  audioUrl: string;
  durationSeconds: number;
  /** Null on rows cached before word timings existed, and on voices/languages that cannot produce
   * them. Callers fall back to estimation rather than treating this as an error. */
  words?: WordTiming[] | null;
}

/** Injected by the caller so this module stays free of a DB dependency. */
export interface TtsCache {
  get(textHash: string): Promise<CachedTts | null>;
  put(entry: {
    textHash: string;
    langCode: string;
    voiceName: string;
    speakingRate: number;
    pitch: number;
    textPreview: string;
    audioUrl: string;
    durationSeconds: number;
    charCount: number;
    estimatedCostUsd: number;
    words?: WordTiming[];
  }): Promise<CachedTts>;
}

export interface ResolveNarrationOptions {
  /** Per-language voice, normally from the project's theme. */
  voices?: Partial<Record<NarrationLang, string>>;
  cache?: TtsCache;
  /** Called once per cache miss, for worker progress logging. */
  onSynthesized?: (info: { segmentId: string; charCount: number; costUsd: number }) => void;
}

export function voiceForSegment(segment: NarrationSegment, voices?: Partial<Record<NarrationLang, string>>): string {
  if (segment.voice) return segment.voice;
  // A Japanese segment always gets a Japanese voice, even inside an English-narrated video.
  if (segment.lang === "ja") return voices?.ja ?? JAPANESE_VOICE;
  return voices?.[segment.lang] ?? DEFAULT_VOICES[segment.lang];
}

/**
 * Fills in `audio` on every segment, synthesizing only what the cache misses.
 *
 * This is the step every downstream duration depends on: scene frame spans, caption cues, and
 * the total video length are all computed from the durations returned here.
 */
export async function resolveNarrationAudio(
  segments: NarrationSegment[],
  options: ResolveNarrationOptions = {}
): Promise<NarrationSegment[]> {
  const resolved: NarrationSegment[] = [];

  for (const segment of segments) {
    const voiceName = voiceForSegment(segment, options.voices);
    const ssml = segment.ssml ?? buildSsml(segment);
    const req: SynthesisRequest = {
      ssml,
      voiceName,
      lang: segment.lang,
      speakingRate: segment.speakingRate ?? 1.0,
      pitch: segment.pitch ?? 0,
    };
    // `lang` is deliberately absent from the hash — see ttsHash. It selects whether marks are
    // inserted, and marks do not change a single audio sample, so two requests differing only in
    // it must share a cache entry.
    const hash = ttsHash(req);

    const hit = await options.cache?.get(hash);
    if (hit) {
      resolved.push({
        ...segment,
        ssml,
        audio: {
          url: hit.audioUrl,
          durationSeconds: hit.durationSeconds,
          ttsAssetId: hit.id,
          words: hit.words ?? undefined,
        },
      });
      continue;
    }

    const audio = await synthesize(req);
    const audioUrl = await uploadToR2(`video/tts/${hash}.wav`, audio.buffer, "audio/wav");
    options.onSynthesized?.({ segmentId: segment.id, charCount: audio.charCount, costUsd: audio.estimatedCostUsd });

    const stored = (await options.cache?.put({
      textHash: hash,
      langCode: languageCodeFromVoice(voiceName),
      voiceName,
      speakingRate: req.speakingRate,
      pitch: req.pitch,
      textPreview: (segment.spokenAs || segment.text).slice(0, 200),
      audioUrl,
      durationSeconds: audio.durationSeconds,
      charCount: audio.charCount,
      estimatedCostUsd: audio.estimatedCostUsd,
      words: audio.words,
    })) ?? { id: hash, audioUrl, durationSeconds: audio.durationSeconds, words: audio.words };

    resolved.push({
      ...segment,
      ssml,
      audio: {
        url: stored.audioUrl,
        durationSeconds: stored.durationSeconds,
        ttsAssetId: stored.id,
        words: stored.words ?? audio.words,
      },
    });
  }

  return resolved;
}
