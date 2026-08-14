import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getChannel, markChannelAuthError, saveChannelCredentials } from "@/lib/social/channels";
import { socialCryptoConfigured } from "@/lib/social/secrets";
import { fetchChannelIdentity, youtubeAdapter } from "@/lib/social/adapters/youtube";
import { oauthRedirectUri, verifyOAuthState } from "@/lib/social/oauthState";

/** Completes the handshake, seals the refresh token, and records which account was connected. */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return NextResponse.redirect(`${url.origin}/admin/social/channels?error=${encodeURIComponent(denied)}`);
  if (!code || !state) return NextResponse.json({ error: "Missing code or state" }, { status: 400 });

  // Verify the state we signed on the way out, so this can only complete a handshake we began.
  const channelId = verifyOAuthState(state);
  if (!channelId) return NextResponse.json({ error: "State signature does not verify" }, { status: 400 });

  const channel = await getChannel(channelId);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (channel.platform !== platform) {
    return NextResponse.json({ error: "State is for a different platform" }, { status: 400 });
  }
  if (!socialCryptoConfigured()) {
    return NextResponse.json(
      {
        error:
          "SOCIAL_TOKEN_KEY is not set, so the refresh token cannot be stored safely. Generate one with `openssl rand -base64 32`, set it here AND in the GitHub Actions secrets the publish worker uses, then reconnect.",
      },
      { status: 400 }
    );
  }

  try {
    const creds = await youtubeAdapter.oauth!.exchangeCode(code, oauthRedirectUri(platform));
    const identity = await fetchChannelIdentity(String(creds.accessToken ?? ""));

    const saved = await saveChannelCredentials({
      channelId,
      credentials: creds,
      expectedVersion: channel.credentialsVersion,
      externalAccountId: identity?.id ?? null,
      externalAccountName: identity?.title ?? null,
      scopes: ["youtube.upload", "youtube.readonly"],
      tokenExpiresAt: creds.expiresAt ? new Date(Number(creds.expiresAt)).toISOString() : null,
    });

    if (!saved.ok) {
      // Someone else connected this channel while the browser was at Google.
      return NextResponse.redirect(`${url.origin}/admin/social/channels?error=changed-underneath`);
    }

    // Deliberately does NOT enable auto-post. Connecting an account and letting it publish on its
    // own are separate decisions, and the second one should be made on purpose.
    return NextResponse.redirect(
      `${url.origin}/admin/social/channels?connected=${encodeURIComponent(identity?.title ?? platform)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    await markChannelAuthError(channelId, "error", message);
    return NextResponse.redirect(`${url.origin}/admin/social/channels?error=${encodeURIComponent(message)}`);
  }
}
