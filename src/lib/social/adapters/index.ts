/**
 * Adapter registry and the auto-post gate.
 *
 * The entire "is this platform allowed to post by itself" decision lives in `resolveAdapter()`,
 * in one place, expressed as four conditions. Everything else in the engine calls the adapter it
 * gets back and does not care which one it is — so turning a platform on is a boolean, and
 * turning it off again is the same boolean.
 */
import { PLATFORMS, type PlatformId } from "../platforms";
import { makeManualAdapter, shareIntentUrl } from "./manual";
import { youtubeAdapter } from "./youtube";
import type { AdapterCapability, PlatformAdapter } from "./types";
import type { SocialChannelPublic } from "../types";

/**
 * Real auto-posting adapters, added one at a time as each platform's approval lands.
 *
 * Being listed here does NOT switch a platform on. `resolveAdapter()` below still requires
 * credentials, a healthy auth status, and an admin having flipped `auto_post_enabled` — so
 * YouTube sitting in this map changes nothing until someone connects an account.
 */
const REGISTRY: Partial<Record<PlatformId, PlatformAdapter>> = {
  youtube: youtubeAdapter,
};

const MANUAL: Record<string, PlatformAdapter> = {};
function manualFor(platform: PlatformId): PlatformAdapter {
  if (!MANUAL[platform]) MANUAL[platform] = makeManualAdapter(platform);
  return MANUAL[platform];
}

/**
 * The gate.
 *
 * A channel gets its real adapter only when all four hold: the platform approval landed and an
 * admin flipped `auto_post_enabled`, credentials exist and are healthy, and an adapter is
 * actually implemented. Anything else resolves to manual — which always works.
 */
export function resolveAdapter(channel: SocialChannelPublic): PlatformAdapter {
  const real = REGISTRY[channel.platform];
  if (!real) return manualFor(channel.platform);
  if (!channel.autoPostEnabled) return manualFor(channel.platform);
  if (!channel.hasCredentials || channel.authStatus !== "connected") return manualFor(channel.platform);
  if (!real.capability(channel).autoPost) return manualFor(channel.platform);
  return real;
}

/** Whether a real adapter exists at all, regardless of whether this channel may use it. */
export function hasAutoPostAdapter(platform: PlatformId): boolean {
  return Boolean(REGISTRY[platform]);
}

export interface ChannelCapabilityReport {
  platform: PlatformId;
  channelId: string;
  autoPost: boolean;
  /** Plain-English explanation, shown next to the channel in the UI. */
  reason: string;
  inlineSafe: boolean;
  hasIntent: boolean;
}

/**
 * Why each channel can or cannot post by itself.
 *
 * Rendered in the workspace so the state is never a mystery: "auto-post is off because the Meta
 * app has not been approved" is actionable, a greyed-out button is not.
 */
export function capabilityReport(channels: SocialChannelPublic[]): ChannelCapabilityReport[] {
  return channels.map((channel) => {
    const adapter = resolveAdapter(channel);
    const capability: AdapterCapability = adapter.capability(channel);
    const real = REGISTRY[channel.platform];

    let reason = capability.reason ?? "";
    if (!real) {
      reason = channel.autoPostBlockedReason ?? "No auto-post adapter is implemented for this platform yet.";
    } else if (!channel.autoPostEnabled) {
      reason = channel.autoPostBlockedReason ?? "Auto-post is switched off for this channel.";
    } else if (!channel.hasCredentials) {
      reason = "Not connected — no credentials stored.";
    } else if (channel.authStatus !== "connected") {
      reason = channel.authError ?? `Credentials are ${channel.authStatus}.`;
    }

    return {
      platform: channel.platform,
      channelId: channel.id,
      autoPost: capability.autoPost,
      reason,
      inlineSafe: capability.inlineSafe,
      hasIntent: Boolean(shareIntentUrl(channel.platform, { text: "x", url: "https://example.com" })),
    };
  });
}

export { shareIntentUrl, primaryText } from "./manual";
export * from "./types";

/** Every platform has an adapter, even if it is the manual one. */
export function allPlatformsCovered(): boolean {
  return PLATFORMS.every((p) => Boolean(REGISTRY[p]) || Boolean(manualFor(p)));
}
