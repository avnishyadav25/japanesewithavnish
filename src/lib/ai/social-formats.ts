/** Shared social-image aspect-ratio presets, generalizing what was previously duplicated as
 * ad hoc inline `{ aspectRatio: "1:1" }` / `{ aspectRatio: "9:16" }` literals scattered across
 * SocialPrepareForm.tsx's per-platform buttons. Aspect ratio here is a prompt-text hint (the
 * image providers behind /api/ai/generate-image don't take a real width/height param) — see
 * the "Aspect ratio {ar}." append in that route. */
export type SocialFormatId = "square" | "story" | "landscape" | "og" | "pin";

export interface SocialImageFormat {
  id: SocialFormatId;
  label: string;
  aspectRatio: string;
  description: string;
}

export const SOCIAL_IMAGE_FORMATS: SocialImageFormat[] = [
  { id: "square", label: "Square", aspectRatio: "1:1", description: "IG post/carousel, Facebook, LinkedIn, Pinterest square" },
  { id: "story", label: "Story / Reel", aspectRatio: "9:16", description: "IG/FB Stories, Reels, TikTok" },
  { id: "landscape", label: "Landscape", aspectRatio: "16:9", description: "Feature/hero image, Twitter/X card, YouTube thumbnail" },
  { id: "og", label: "Link preview", aspectRatio: "1.91:1", description: "Facebook/LinkedIn OG share image" },
  { id: "pin", label: "Pinterest Pin", aspectRatio: "2:3", description: "Tall Pinterest pin" },
];

export function getSocialFormat(id: SocialFormatId): SocialImageFormat {
  return SOCIAL_IMAGE_FORMATS.find((f) => f.id === id) ?? SOCIAL_IMAGE_FORMATS[2];
}
