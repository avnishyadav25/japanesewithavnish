import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getChannel } from "@/lib/social/channels";
import { youtubeAdapter } from "@/lib/social/adapters/youtube";
import { createOAuthState, oauthRedirectUri } from "@/lib/social/oauthState";

/** Starts the OAuth handshake for a channel. State is signed — see @/lib/social/oauthState. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  if (channel.platform !== "youtube") {
    return NextResponse.json(
      { error: `No OAuth flow is implemented for ${channel.platform} yet — it is on the manual path.` },
      { status: 400 }
    );
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set. Create a Web application OAuth client in the same Google Cloud project as your TTS service account, and add this redirect URI: " +
          oauthRedirectUri("youtube"),
      },
      { status: 400 }
    );
  }

  return NextResponse.redirect(
    youtubeAdapter.oauth!.authorizeUrl(createOAuthState(id), oauthRedirectUri("youtube"))
  );
}
