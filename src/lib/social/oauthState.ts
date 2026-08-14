/**
 * Signed OAuth state, shared by the start and callback routes.
 *
 * Lives here rather than in the route because a Next.js route module may only export request
 * handlers — exporting a helper from one fails the production build with a fairly opaque
 * "does not match the required types of a Next.js Route".
 *
 * The state is HMAC-signed rather than stored in a session: the callback has to prove the
 * request it is completing is the one we started, and an unsigned state would let anyone hand
 * us an authorization code for an account we never asked about.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { BRAND } from "../brand";

export function oauthRedirectUri(platform: string): string {
  return `${BRAND.siteUrl}/api/admin/social/oauth/callback/${platform}`;
}

function sign(payload: string): string {
  const secret = process.env.ACCESS_TOKEN_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(channelId: string): string {
  const payload = `${channelId}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the channel id when the signature verifies, null otherwise. */
export function verifyOAuthState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;

  const [channelId, nonce, signature] = parts;
  const expected = sign(`${channelId}.${nonce}`);
  if (expected.length !== signature.length) return null;

  // Constant time, so the signature cannot be probed a byte at a time.
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) ? channelId : null;
}
