/**
 * The manual adapter — the one that works on day one, for every platform.
 *
 * This is a real implementation, not a placeholder. Every platform in this project is gated on
 * someone else's approval queue (Meta Advanced Access, a TikTok audit, a YouTube API audit), and
 * those take weeks. Treating manual posting as the fallback branch of an "if auto-post fails"
 * would mean the whole feature does nothing until the first approval lands.
 *
 * So `publish()` here does not fail — it returns `manual_required`, which moves the row to
 * `awaiting_manual`. That is a legitimate resting state: the copy is ready, the intent URL is
 * one click away, and the admin pastes the live URL back when it is up.
 *
 * Pure. No `next/*`, no `@/`, no DB.
 */
import { getRule, surfacesForPlatform, type PlatformId, type SurfaceId } from "../platforms";
import type { AdapterCapability, PlatformAdapter, PublishResult } from "./types";
import type { SurfaceContent } from "../types";

/** The single best block of text to hand the clipboard for a surface. */
export function primaryText(surface: SurfaceId, content: SurfaceContent, hashtags: string[]): string {
  const rule = getRule(surface);
  const parts: string[] = [];

  for (const field of rule.fields) {
    const value = content[field.key];
    if (!value) continue;

    if (Array.isArray(value)) {
      // A thread or a carousel: number the items so the order survives the paste.
      value.forEach((item, i) => {
        if (typeof item === "string") parts.push(`${i + 1}. ${item}`);
        else if (item && typeof item === "object") {
          const obj = item as Record<string, string>;
          parts.push([`${i + 1}. ${obj.title ?? ""}`.trim(), obj.body ?? ""].filter(Boolean).join("\n"));
        }
      });
      continue;
    }
    if (typeof value === "string") parts.push(value);
  }

  if (rule.hashtags.placement === "in_body" && hashtags.length > 0) parts.push(hashtags.join(" "));
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Web-intent URL, where the platform has one.
 *
 * Only X, Facebook, Threads, LinkedIn, Pinterest and Reddit expose one. Instagram, TikTok and
 * YouTube have no equivalent — for those, copy-and-upload is genuinely the only manual route,
 * and returning undefined lets the UI say so rather than offering a link that goes nowhere.
 */
export function shareIntentUrl(
  platform: PlatformId,
  params: { text: string; url: string | null; title?: string }
): string | undefined {
  const text = encodeURIComponent(params.text.slice(0, 900));
  const url = params.url ? encodeURIComponent(params.url) : "";
  const title = encodeURIComponent(params.title ?? "");

  switch (platform) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${text}${url ? `&url=${url}` : ""}`;
    case "facebook":
      return url ? `https://www.facebook.com/sharer/sharer.php?u=${url}` : undefined;
    case "threads":
      return `https://www.threads.net/intent/post?text=${text}${url ? `%20${url}` : ""}`;
    case "linkedin":
      return url ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}` : undefined;
    case "pinterest":
      return url ? `https://pinterest.com/pin/create/button/?url=${url}&description=${text}` : undefined;
    case "reddit":
      return url ? `https://www.reddit.com/submit?url=${url}&title=${title}` : `https://www.reddit.com/submit?title=${title}&text=${text}`;
    default:
      // instagram, tiktok, youtube, blog — no usable web intent.
      return undefined;
  }
}

export function makeManualAdapter(platform: PlatformId): PlatformAdapter {
  return {
    id: platform,
    surfaces: surfacesForPlatform(platform),

    capability(): AdapterCapability {
      return {
        autoPost: false,
        inlineSafe: true,
        reason: shareIntentUrl(platform, { text: "x", url: "https://example.com" })
          ? "Copy the text, post it, then paste the live URL back."
          : "This platform has no web intent — upload by hand, then paste the live URL back.",
      };
    },

    async validate(): Promise<[]> {
      // Nothing to validate: a human is about to look at it.
      return [];
    },

    async publish(): Promise<PublishResult> {
      // Never throws and never fails. `manual_required` is a resting state, not an error.
      return { status: "manual_required" };
    },
  };
}
