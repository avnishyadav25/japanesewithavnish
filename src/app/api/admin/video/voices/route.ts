import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { uploadToR2 } from "@/lib/r2";
import { synthesize, ttsConfigured, wavDurationSeconds } from "@/lib/video/tts";
import { VOICE_CATALOGUE, VOICE_SAMPLE_TEXT, isKnownVoice, supportsSsml } from "@/lib/video/voices";
import { NARRATION_LANGS, type NarrationLang } from "@/lib/video/types";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ catalogue: VOICE_CATALOGUE, configured: ttsConfigured() });
}

/**
 * Synthesises one sample phrase so a voice can be heard before it is chosen.
 *
 * Deliberately routed through the same `synthesize()` the render pipeline uses, and cached in R2
 * by voice + rate, so the sample is genuinely what the video will sound like and a second click
 * on the same voice costs nothing. A phrase is ~60 characters — about $0.001 the first time.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ttsConfigured()) {
    return NextResponse.json({ error: "Google TTS is not configured. Run npm run video:doctor." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const lang = body?.lang as NarrationLang;
  const voice = typeof body?.voice === "string" ? body.voice : "";
  const rate = typeof body?.rate === "number" ? Math.min(1.5, Math.max(0.5, body.rate)) : 1.0;

  if (!NARRATION_LANGS.includes(lang)) {
    return NextResponse.json({ error: `lang must be one of: ${NARRATION_LANGS.join(", ")}` }, { status: 400 });
  }
  // Only catalogue voices, so this cannot be used to probe arbitrary Google voice names.
  if (!isKnownVoice(lang, voice)) {
    return NextResponse.json({ error: "Unknown voice for that language" }, { status: 400 });
  }

  const text = typeof body?.text === "string" && body.text.trim() ? body.text.trim().slice(0, 200) : VOICE_SAMPLE_TEXT[lang];

  try {
    const audio = await synthesize({
      // synthesize() strips the wrapper again for Chirp3, which takes plain text only.
      ssml: supportsSsml(voice) ? `<speak>${text}</speak>` : text,
      voiceName: voice,
      speakingRate: rate,
      pitch: 0,
    });

    const key = `video/voice-samples/${voice}-${rate}.wav`;
    const url = await uploadToR2(key, audio.buffer, "audio/wav");

    return NextResponse.json({
      url,
      voice,
      rate,
      text,
      durationSeconds: wavDurationSeconds(audio.buffer),
      costUsd: audio.estimatedCostUsd,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not synthesise a sample" },
      { status: 500 }
    );
  }
}
