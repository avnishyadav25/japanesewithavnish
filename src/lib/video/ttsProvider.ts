/**
 * The seam between "narration needs audio" and "Google Cloud TTS".
 *
 * Everything about the current implementation is Google-shaped and was not separable: the
 * synthesize call, `languageCodeFromVoice` (which THROWS on any voice name that is not
 * `xx-YY-Something`), the per-tier pricing table, and the assumption that output is a RIFF WAV
 * whose duration can be read from its header. A cloned voice satisfies none of those.
 *
 * This does not replace any of it. Google remains the default and its behaviour is unchanged;
 * the interface simply names the boundary so a second engine can be registered beside it.
 *
 * WHY A REGISTRY AND NOT A SWAP. Voices are chosen per segment, and a project will realistically
 * mix them — a cloned English narrator over Google's ja-JP for the Japanese, because a voice
 * cloned from English audio should not be reading Japanese. So the provider is resolved from the
 * voice NAME, not from a global setting.
 */
import type { SynthesisRequest, SynthesizedAudio } from "./tts";

export interface TtsProvider {
  /** Stable id, also the prefix its voice names carry. */
  id: string;
  /** True when this provider owns that voice name. */
  owns(voiceName: string): boolean;
  /** Whether the provider is usable right now — credentials present, model downloaded, etc. */
  configured(): boolean;
  synthesize(req: SynthesisRequest): Promise<SynthesizedAudio>;
}

const providers: TtsProvider[] = [];

/**
 * Registers a provider. Later registrations win for a contested voice name, so a self-hosted
 * engine can shadow a Google voice without editing this file.
 */
export function registerTtsProvider(provider: TtsProvider): void {
  providers.unshift(provider);
}

export function providerForVoice(voiceName: string): TtsProvider | null {
  return providers.find((p) => p.owns(voiceName)) ?? null;
}

export function registeredProviders(): TtsProvider[] {
  return [...providers];
}

/**
 * Voice names owned by a cloned-voice engine.
 *
 * The `cloned:` prefix is what makes the registry work without a config flag: `languageCodeFromVoice`
 * would throw on it, `isKnownVoice` returns false for it, and the cache key already includes the
 * voice name — so a cloned segment gets its own cache entry and can never be served Google audio
 * by accident.
 */
export const CLONED_VOICE_PREFIX = "cloned:";

export function isClonedVoice(voiceName: string): boolean {
  return voiceName.startsWith(CLONED_VOICE_PREFIX);
}

/** `cloned:avnish-en` -> `en`. */
export function clonedVoiceLang(voiceName: string): string | null {
  if (!isClonedVoice(voiceName)) return null;
  const parts = voiceName.slice(CLONED_VOICE_PREFIX.length).split("-");
  return parts[parts.length - 1] || null;
}
