/**
 * Google Cloud TTS voice catalogue.
 *
 * A curated shortlist rather than the full API listing: Google offers hundreds of voices per
 * language and almost all of the choice is noise. These are the ones worth putting in a
 * dropdown, with the one caveat that actually changes behaviour called out below.
 *
 * No `next/*` imports — the worker reads this too.
 */
import type { NarrationLang } from "./types";

export interface VoiceOption {
  name: string;
  label: string;
  gender: "female" | "male";
  tier: "Neural2" | "Chirp3-HD";
  /** Shown in the picker so the trade-off is visible at the point of choosing. */
  note?: string;
}

/**
 * Chirp 3: HD voices do NOT accept SSML — plain text only.
 *
 * This is not a detail that can be papered over: sending `<speak>…</speak>` to one either errors
 * or gets read out as literal angle brackets. src/lib/video/tts.ts checks this and switches the
 * request between `input.ssml` and `input.text` accordingly. The practical consequence is that
 * `<break>` tags are unavailable on Chirp3 — our pauses are timeline gaps rather than SSML
 * breaks, so nothing is lost.
 */
export function supportsSsml(voiceName: string): boolean {
  return !voiceName.includes("Chirp3");
}

export function isChirp3(voiceName: string): boolean {
  return voiceName.includes("Chirp3");
}

export const VOICE_CATALOGUE: Record<NarrationLang, VoiceOption[]> = {
  en: [
    { name: "en-US-Neural2-F", label: "Aria (US, warm)", gender: "female", tier: "Neural2", note: "Current default" },
    { name: "en-US-Neural2-C", label: "Nova (US, bright)", gender: "female", tier: "Neural2" },
    { name: "en-US-Neural2-D", label: "Miles (US)", gender: "male", tier: "Neural2" },
    { name: "en-US-Chirp3-HD-Aoede", label: "Aoede (US, natural)", gender: "female", tier: "Chirp3-HD", note: "Most natural" },
    { name: "en-US-Chirp3-HD-Kore", label: "Kore (US, natural)", gender: "female", tier: "Chirp3-HD" },
    { name: "en-US-Chirp3-HD-Puck", label: "Puck (US, natural)", gender: "male", tier: "Chirp3-HD" },
    { name: "en-IN-Neural2-A", label: "Ananya (Indian English)", gender: "female", tier: "Neural2", note: "Matches the core audience" },
    { name: "en-IN-Neural2-B", label: "Rohan (Indian English)", gender: "male", tier: "Neural2" },
  ],
  // Romanised Hinglish on Indian ENGLISH voices, deliberately. A hi-IN voice handed Latin script
  // reads it as Hindi phonetics; en-IN handles "Aaj hum paanch shabd seekhenge" naturally, and
  // measured almost exactly at the English rate (15.45 vs 16.30 c/s).
  hinglish: [
    { name: "en-IN-Neural2-A", label: "Ananya (Indian English)", gender: "female", tier: "Neural2", note: "Current default" },
    { name: "en-IN-Neural2-B", label: "Rohan (Indian English)", gender: "male", tier: "Neural2" },
    { name: "hi-IN-Neural2-A", label: "Aditi (Hindi voice, more Hindi-leaning accent)", gender: "female", tier: "Neural2" },
  ],
  hi: [
    { name: "hi-IN-Neural2-A", label: "Aditi", gender: "female", tier: "Neural2", note: "Current default" },
    { name: "hi-IN-Neural2-D", label: "Kavya", gender: "female", tier: "Neural2" },
    { name: "hi-IN-Neural2-B", label: "Arjun", gender: "male", tier: "Neural2" },
    { name: "hi-IN-Chirp3-HD-Aoede", label: "Aoede (natural)", gender: "female", tier: "Chirp3-HD", note: "Most natural" },
    { name: "hi-IN-Chirp3-HD-Puck", label: "Puck (natural)", gender: "male", tier: "Chirp3-HD" },
  ],
  ja: [
    { name: "ja-JP-Neural2-B", label: "Hana (female)", gender: "female", tier: "Neural2", note: "Current default" },
    { name: "ja-JP-Neural2-C", label: "Kenji (male)", gender: "male", tier: "Neural2" },
    { name: "ja-JP-Neural2-D", label: "Takumi (male)", gender: "male", tier: "Neural2" },
    { name: "ja-JP-Chirp3-HD-Aoede", label: "Aoede (natural)", gender: "female", tier: "Chirp3-HD", note: "Most natural" },
    { name: "ja-JP-Chirp3-HD-Kore", label: "Kore (natural)", gender: "female", tier: "Chirp3-HD" },
    { name: "ja-JP-Chirp3-HD-Puck", label: "Puck (natural)", gender: "male", tier: "Chirp3-HD" },
  ],
};

/** A short phrase per language for the ▶ preview button. The Japanese one deliberately contains
 * a long vowel and a geminate consonant — the two things a bad voice gets wrong. */
export const VOICE_SAMPLE_TEXT: Record<NarrationLang, string> = {
  en: "Here's your first word. Listen carefully, then say it back.",
  hi: "यह आपका पहला शब्द है। ध्यान से सुनिए, फिर दोहराइए।",
  hinglish: "Yeh aapka pehla word hai. Dhyaan se suniye, phir dohraiye.",
  ja: "はじめまして。今日は日本語を勉強しましょう。",
};

export function isKnownVoice(lang: NarrationLang, name: string): boolean {
  return VOICE_CATALOGUE[lang].some((v) => v.name === name);
}

/** Language code from a voice name, e.g. "ja-JP-Neural2-B" -> "ja-JP". */
export function languageCodeFromVoice(voiceName: string): string {
  const match = /^([a-z]{2}-[A-Z]{2})/.exec(voiceName);
  if (!match) throw new Error(`Cannot derive a language code from voice name "${voiceName}"`);
  return match[1];
}
