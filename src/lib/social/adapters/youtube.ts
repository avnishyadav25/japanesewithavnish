/**
 * YouTube — upload, thumbnail, captions.
 *
 * The first real auto-post adapter, and the one most likely to be usable first: uploading to
 * your own channel needs no partner approval, only a Google OAuth client and (for public
 * uploads) an API audit.
 *
 * THE MOST IMPORTANT LINE IN THIS FILE is the one that reuses `resume.sessionUrl`. A resumable
 * upload session IS the idempotency key: continuing an existing session after a crash finishes
 * one video, while starting a fresh one uploads a SECOND copy to the channel. There is no undo
 * for that from the viewer's side — subscribers get notified twice.
 *
 * No `@/` imports and no DB: everything comes through AdapterContext, so the publish worker can
 * load this under plain tsx and so it is testable without a database.
 */
import { getRule, surfacesForPlatform, type SurfaceId } from "../platforms";
import { AdapterError, type AdapterCapability, type AdapterContext, type AdapterIssue, type PlatformAdapter, type PublishInput, type PublishResult } from "./types";
import type { SocialChannelPublic, StoredCredentials } from "../types";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const API_URL = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** Must be a multiple of 256 KB, per the resumable-upload spec. */
const CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Default quota is 10,000 units a day and an upload costs 1,600 — six a day, total.
 *
 * Not a rate limit that politely slows you down: it is a 403 after the bytes have moved. So it
 * is checked before anything uploads.
 */
const UPLOAD_QUOTA_COST = 1600;
export const DAILY_UPLOAD_LIMIT = 6;

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

interface YouTubeCreds extends StoredCredentials {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}

function clientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!id) throw new AdapterError("GOOGLE_OAUTH_CLIENT_ID is not set", false);
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) throw new AdapterError("GOOGLE_OAUTH_CLIENT_SECRET is not set", false);
  return secret;
}

/** Refreshes the access token when it is missing or within a minute of expiry. */
async function ensureAccessToken(
  input: PublishInput,
  ctx: AdapterContext
): Promise<string> {
  const creds = input.channel.credentials as YouTubeCreds;
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > Date.now() + 60_000) {
    return creds.accessToken;
  }
  if (!creds.refreshToken) {
    throw new AdapterError("This channel has no refresh token — reconnect it.", false);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AdapterError(`Token refresh failed: ${body.slice(0, 200)}`, res.status >= 500);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const next: YouTubeCreds = {
    ...creds,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  // Compare-and-swap: if another publish refreshed first, this throws rather than clobbering the
  // token that publish is already using.
  await ctx.saveCredentials(input.channel.id, next, input.channel.credentialsVersion);
  return data.access_token;
}

/** Shorts is a URL shape, not an API flag: vertical and short enough, and YouTube files it. */
function watchUrl(videoId: string, surface: SurfaceId): string {
  return surface === "youtube.short" ? `https://youtube.com/shorts/${videoId}` : `https://youtu.be/${videoId}`;
}

async function validate(input: PublishInput): Promise<AdapterIssue[]> {
  const issues: AdapterIssue[] = [];
  const rule = getRule(input.surface);
  const video = input.media.find((m) => m.kind === "video");

  if (!video) {
    issues.push({ level: "error", message: "No video file attached to this post." });
    return issues;
  }
  if (!input.content.title) issues.push({ level: "error", message: "A title is required." });

  const max = rule.media.maxDurationSeconds;
  if (max && video.durationSeconds && video.durationSeconds > max) {
    issues.push({
      level: "error",
      message: `${rule.label} allows ${max}s; this render is ${Math.round(video.durationSeconds)}s.`,
    });
  }
  if (input.surface === "youtube.short" && video.width && video.height && video.width >= video.height) {
    issues.push({ level: "error", message: "A Short must be vertical — this render is not." });
  }
  return issues;
}

async function publish(input: PublishInput, ctx: AdapterContext): Promise<PublishResult> {
  const preflight = await validate(input);
  const blocking = preflight.filter((i) => i.level === "error");
  if (blocking.length > 0) throw new AdapterError(blocking.map((i) => i.message).join(" "), false);

  const access = await ensureAccessToken(input, ctx);
  const video = input.media.find((m) => m.kind === "video")!;
  const totalBytes = video.bytes ?? 0;
  if (!totalBytes) throw new AdapterError("Video size is unknown; refusing to start an upload.", false);

  // 1. Start, or resume. Reusing the stored session URL is what makes a retry idempotent.
  let sessionUrl = input.resume?.sessionUrl ?? null;
  if (!sessionUrl) {
    const description = String(input.content.description ?? "");
    const start = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(totalBytes),
        "X-Upload-Content-Type": video.mimeType,
      },
      body: JSON.stringify({
        snippet: {
          title: String(input.content.title),
          description,
          tags: input.hashtags.map((h) => h.replace(/^#/, "")).slice(0, 15),
          categoryId: "27", // Education
          defaultLanguage: input.lang === "en" ? "en" : "hi",
        },
        status: {
          // A scheduled upload MUST start private; publishAt is ignored otherwise.
          privacyStatus: input.scheduledFor ? "private" : String(input.channel.config.privacy ?? "public"),
          publishAt: input.scheduledFor ?? undefined,
          selfDeclaredMadeForKids: false,
        },
      }),
    });
    if (!start.ok) {
      const body = await start.text().catch(() => "");
      throw new AdapterError(`Could not start the upload: ${body.slice(0, 300)}`, start.status >= 500, start.status);
    }
    sessionUrl = start.headers.get("location");
    if (!sessionUrl) throw new AdapterError("YouTube did not return an upload session URL", true);
    await ctx.saveUploadProgress(input.postId, sessionUrl, 0);
    await ctx.log(`Upload session opened (${(totalBytes / 1_000_000).toFixed(1)} MB)`);
  } else {
    await ctx.log(`Resuming upload at ${((input.resume?.offset ?? 0) / 1_000_000).toFixed(1)} MB`);
  }

  // 2. Chunked PUT. 308 means "keep going"; the authoritative offset comes back in Range.
  let offset = input.resume?.offset ?? 0;
  let videoId: string | null = null;

  while (offset < totalBytes) {
    if (ctx.signal?.aborted) throw new AdapterError("Cancelled", true);

    const end = Math.min(offset + CHUNK_BYTES, totalBytes) - 1;
    const chunk = await ctx.fetchMedia(`${video.url}#bytes=${offset}-${end}`);
    const body = await new Response(chunk.body as unknown as ReadableStream).arrayBuffer();

    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(end - offset + 1),
        "Content-Range": `bytes ${offset}-${end}/${totalBytes}`,
      },
      body,
    });

    if (res.status === 308) {
      const range = res.headers.get("range");
      offset = range ? Number(range.split("-")[1]) + 1 : end + 1;
      await ctx.saveUploadProgress(input.postId, sessionUrl, offset);
      await ctx.heartbeat();
      continue;
    }
    if (res.status === 200 || res.status === 201) {
      const data = (await res.json()) as { id?: string };
      videoId = data.id ?? null;
      break;
    }
    const text = await res.text().catch(() => "");
    throw new AdapterError(`Upload failed at ${offset}: ${text.slice(0, 300)}`, res.status >= 500, res.status);
  }

  if (!videoId) throw new AdapterError("Upload finished without returning a video id", true);
  await ctx.log(`Uploaded as ${videoId}`);

  // 3. Thumbnail and captions — both columns already exist on video_renders and nothing
  //    consumed them until now. Neither failure is worth losing the upload over.
  const poster = input.media.find((m) => m.kind === "image");
  if (poster) {
    try {
      const image = await ctx.fetchMedia(poster.url);
      await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": poster.mimeType },
        body: await new Response(image.body as unknown as ReadableStream).arrayBuffer(),
      });
    } catch (err) {
      await ctx.log(`Thumbnail upload failed (video is fine): ${err instanceof Error ? err.message : err}`);
    }
  }

  const captions = input.media.find((m) => m.kind === "caption");
  if (captions) {
    try {
      const srt = await ctx.fetchMedia(captions.url);
      const form = `--b\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({
        snippet: { videoId, language: input.lang === "en" ? "en" : "hi", name: "", isDraft: false },
      })}\r\n--b\r\nContent-Type: application/octet-stream\r\n\r\n`;
      void form;
      void srt;
      // Caption upload is a multipart request against captions.insert; wired once a real channel
      // exists to test it against, rather than guessed at now.
      await ctx.log("Captions available but not uploaded — see the note in youtube.ts");
    } catch {
      /* non-fatal */
    }
  }

  return {
    status: input.scheduledFor ? "scheduled" : "published",
    externalId: videoId,
    externalUrl: watchUrl(videoId, input.surface),
    externalState: input.scheduledFor ? "scheduled" : "processing",
  };
}

function capability(channel: SocialChannelPublic): AdapterCapability {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return {
      autoPost: false,
      inlineSafe: false,
      reason: "GOOGLE_OAUTH_CLIENT_ID / _SECRET are not set in this environment.",
    };
  }
  if (!channel.hasCredentials || channel.authStatus !== "connected") {
    return { autoPost: false, inlineSafe: false, reason: "Not connected — run the OAuth flow." };
  }
  return {
    autoPost: true,
    // Never inline: a 100-200MB upload cannot finish inside a Netlify function.
    inlineSafe: false,
  };
}

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",
  surfaces: surfacesForPlatform("youtube"),
  capability,
  validate,
  publish,

  async verify({ externalUrl }) {
    // A deleted or rejected video 404s on the watch page.
    const res = await fetch(externalUrl, { method: "HEAD" }).catch(() => null);
    return { stillLive: Boolean(res && res.ok) };
  },

  oauth: {
    authorizeUrl(state: string, redirectUri: string): string {
      const params = new URLSearchParams({
        client_id: clientId(),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        // Both required to get a refresh token back — without them Google returns only a
        // one-hour access token and the channel silently stops working after an hour.
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `${AUTH_URL}?${params}`;
    },

    async exchangeCode(code: string, redirectUri: string): Promise<StoredCredentials> {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId(),
          client_secret: clientSecret(),
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new AdapterError(`Token exchange failed: ${(await res.text()).slice(0, 200)}`, false);
      const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
      if (!data.refresh_token) {
        throw new AdapterError(
          "Google did not return a refresh token. Revoke the app at myaccount.google.com/permissions and reconnect — it only issues one on first consent.",
          false
        );
      }
      return {
        refreshToken: data.refresh_token,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
    },

    async refresh(creds: StoredCredentials): Promise<StoredCredentials> {
      const c = creds as YouTubeCreds;
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId(),
          client_secret: clientSecret(),
          refresh_token: String(c.refreshToken),
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) throw new AdapterError("Refresh failed", res.status >= 500);
      const data = (await res.json()) as { access_token: string; expires_in: number };
      return { ...c, accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    },
  },
};

/** Channel identity, for showing which account is connected after the OAuth round trip. */
export async function fetchChannelIdentity(accessToken: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`${API_URL}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { id: string; snippet?: { title?: string } }[] };
  const item = data.items?.[0];
  return item ? { id: item.id, title: item.snippet?.title ?? item.id } : null;
}

export { UPLOAD_QUOTA_COST };
