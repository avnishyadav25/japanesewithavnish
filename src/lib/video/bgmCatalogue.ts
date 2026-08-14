/**
 * Where background music comes from.
 *
 * A note on what this file deliberately is NOT: a hardcoded list of specific track URLs. Audio
 * links rot, and a curated list of eighteen fabricated URLs would be worse than no list — you
 * would discover which ones were wrong one broken import at a time. Instead this describes the
 * SOURCES, their licence terms, and the searches worth running, and the importers fetch real
 * tracks from them.
 *
 * The licence facts here are the point. A copyright claim applies retroactively to every video
 * that used a track, so "which library was this from and what does it permit" has to be recorded
 * at import time, not reconstructed later.
 */

export interface BgmSource {
  id: "dova" | "pixabay" | "jamendo" | "youtube_audio_library" | "fma";
  name: string;
  url: string;
  /** Whether an in-admin browser exists, or you download and paste a URL. */
  integration: "api" | "manual";
  licenceSummary: string;
  commercialUse: "allowed" | "check_per_track";
  attribution: "not_required" | "required" | "check_per_track";
  /** Why you would reach for this one. */
  bestFor: string;
  caveat?: string;
}

export const BGM_SOURCES: BgmSource[] = [
  {
    id: "dova",
    name: "DOVA-SYNDROME",
    url: "https://dova-s.jp/",
    integration: "manual",
    licenceSummary: "Free for commercial use including monetised video, per each contributor's terms.",
    commercialUse: "check_per_track",
    attribution: "check_per_track",
    bestFor: "By far the largest source of genuinely Japanese-flavoured music — koto, shakuhachi, wafū, matsuri.",
    caveat:
      "No API and a Japanese-only site. Download the MP3, then use “Import from URL” or upload it. " +
      "Each contributor sets their own terms — read the track page before using it on a monetised channel.",
  },
  {
    id: "pixabay",
    name: "Pixabay Music",
    url: "https://pixabay.com/music/",
    integration: "manual",
    licenceSummary: "Pixabay Content Licence — free for commercial use, no attribution required.",
    commercialUse: "allowed",
    attribution: "not_required",
    bestFor: "Clean study/lo-fi beds and upbeat corporate tracks. The simplest licence of the lot.",
    caveat:
      "Pixabay's public API covers images and video only — there is no music endpoint, so this " +
      "cannot be browsed in-admin. Download the MP3 and import it by URL or upload.",
  },
  {
    id: "jamendo",
    name: "Jamendo",
    url: "https://www.jamendo.com/",
    integration: "api",
    licenceSummary: "Per-track Creative Commons. CC-BY and CC-BY-SA permit commercial use; anything -NC does not.",
    commercialUse: "check_per_track",
    attribution: "required",
    bestFor: "Searchable in-admin with real licence metadata per track.",
    caveat: "Needs JAMENDO_CLIENT_ID. Always check the commercial-use flag — the browser surfaces it per result.",
  },
  {
    id: "youtube_audio_library",
    name: "YouTube Audio Library",
    url: "https://studio.youtube.com/channel/UC/music",
    integration: "manual",
    licenceSummary: "Cleared for use on YouTube specifically, including monetised videos.",
    commercialUse: "allowed",
    attribution: "check_per_track",
    bestFor: "Zero-risk on YouTube — these tracks will never trigger a Content ID claim there.",
    caveat:
      "Cleared for YouTube. Using them on Instagram or TikTok is outside what that licence covers, " +
      "so keep them for the 16:9 cut if you publish the same content in several places.",
  },
  {
    id: "fma",
    name: "Free Music Archive",
    url: "https://freemusicarchive.org/",
    integration: "manual",
    licenceSummary: "Per-track Creative Commons, mixed terms.",
    commercialUse: "check_per_track",
    attribution: "check_per_track",
    bestFor: "Breadth when nothing else fits.",
    caveat: "Licences vary widely. Read each one; several are non-commercial.",
  },
];

/**
 * Searches worth running, rather than tracks worth downloading.
 *
 * `mood` is stored on the imported track so the picker can group by feel later.
 */
export interface BgmSearchPreset {
  label: string;
  query: string;
  mood: string;
  /** Rough guidance on which video types this suits. */
  suits: string;
}

export const BGM_SEARCH_PRESETS: BgmSearchPreset[] = [
  { label: "Koto / traditional", query: "koto japanese traditional", mood: "traditional", suits: "Kanji, culture notes" },
  { label: "Shakuhachi / meditative", query: "shakuhachi flute meditation", mood: "calm", suits: "Reading, long-form lessons" },
  { label: "Wafū lo-fi", query: "japanese lofi chill", mood: "lofi", suits: "Vocabulary shorts, study content" },
  { label: "Sakura / gentle", query: "sakura gentle piano japan", mood: "gentle", suits: "Intro and outro beds" },
  { label: "Study beats", query: "lofi study beats", mood: "study", suits: "Anything long enough to need a bed" },
  { label: "Upbeat / energetic", query: "upbeat happy ukulele", mood: "upbeat", suits: "Shorts, Reels, TikTok" },
  { label: "Cinematic intro", query: "cinematic inspiring intro", mood: "cinematic", suits: "Course trailers" },
  { label: "Minimal ambient", query: "minimal ambient background", mood: "ambient", suits: "Grammar explainers — stays out of the way" },
];

/**
 * The other way to get trending music, and the only legitimate one.
 *
 * Baking a copyrighted viral track into an MP4 earns a Content ID claim on YouTube — revenue
 * diverted to the rightsholder, sometimes an outright block. But Instagram and TikTok license
 * their own in-app music libraries, and their algorithms actively favour videos using in-app
 * audio. So the move is to render silent and add the track after upload.
 *
 * Selecting this preset renders with no music bed and captions burned in, so the video still
 * works muted while a trending track is laid over it in-app.
 */
export const IN_APP_AUDIO_PRESET = {
  key: "in_app_audio",
  label: "Silent — for in-app trending audio",
  description:
    "No music bed, captions burned in. Upload to Reels or TikTok, then add the trending sound in the app, " +
    "where it is licensed and the algorithm favours it. Do not use this cut for YouTube — it will have no audio bed at all.",
} as const;

/** CC licence URLs that permit commercial use. Anything with "nc" in the path does not. */
export function ccPermitsCommercial(licenceUrl: string | null | undefined): "allowed" | "not_allowed" | "unknown" {
  if (!licenceUrl) return "unknown";
  const url = licenceUrl.toLowerCase();
  if (!url.includes("creativecommons.org")) return "unknown";
  if (url.includes("-nc") || url.includes("/nc")) return "not_allowed";
  if (url.includes("/by/") || url.includes("/by-sa/") || url.includes("/zero/") || url.includes("/publicdomain/")) {
    return "allowed";
  }
  return "unknown";
}
