/**
 * The contract every platform implements.
 *
 * Adapters take their DB and media access as INJECTED CALLBACKS (`AdapterContext`) rather than
 * importing `@/lib/db` or the R2 client. Two reasons, both load-bearing:
 *
 *   1. The publish worker runs under plain tsx, which does not resolve the `@/` alias — the same
 *      constraint that shapes scripts/lib/video/db.ts.
 *   2. It makes an adapter testable without a database or a network, which matters for code
 *      whose failure mode is "posted twice to a real channel".
 *
 * No `next/*`, no `@/`, no DB imports in this file or anything under adapters/.
 */
import type { PlatformId, SocialLang, SurfaceId } from "../platforms";
import type { ChannelRuntime, SocialChannelPublic, StoredCredentials, SurfaceContent } from "../types";

export interface MediaRef {
  kind: "video" | "image" | "caption";
  url: string;
  mimeType: string;
  bytes?: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface PublishInput {
  /** Also the idempotency key the adapter should key any resumable session against. */
  postId: string;
  surface: SurfaceId;
  lang: SocialLang;
  channel: ChannelRuntime;
  /** Already clamped to the surface's limits — an adapter must not re-trim. */
  content: SurfaceContent;
  hashtags: string[];
  media: MediaRef[];
  /** Already UTM-tagged, or null where the surface does not linkify. */
  link: string | null;
  scheduledFor: string | null;
  /** Non-null on resume: a killed worker continues rather than restarting a large upload. */
  resume: { sessionUrl: string | null; offset: number } | null;
}

export interface PublishResult {
  status: "published" | "scheduled" | "pending_external" | "manual_required";
  externalId?: string | null;
  externalUrl?: string | null;
  externalState?: string | null;
  /** Instagram containers and TikTok inbox posts finish asynchronously. */
  pollAfterSeconds?: number | null;
  raw?: unknown;
}

export interface AdapterIssue {
  level: "error" | "warning";
  message: string;
}

export interface AdapterCapability {
  autoPost: boolean;
  /** Why not, in words an admin can act on. Rendered directly in the UI. */
  reason?: string;
  /** Safe to run inside a Next route: no large media, sub-second. */
  inlineSafe: boolean;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface AdapterContext {
  /** Streams media from R2. Injected so adapters never import the S3 client. */
  fetchMedia(url: string): Promise<{ body: NodeJS.ReadableStream; bytes: number; contentType: string }>;
  /** Token-refresh write-back, compare-and-swap on `credentials_version`. */
  saveCredentials(channelId: string, creds: StoredCredentials, expectedVersion: number): Promise<void>;
  /** Persists a resumable session so a crash resumes at the offset instead of re-uploading. */
  saveUploadProgress(postId: string, sessionUrl: string | null, offset: number): Promise<void>;
  log(message: string): Promise<void>;
  heartbeat(): Promise<void>;
  signal?: AbortSignal;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly surfaces: readonly SurfaceId[];
  capability(channel: SocialChannelPublic): AdapterCapability;
  /** Non-throwing preflight. Runs before any bytes move. */
  validate(input: PublishInput): Promise<AdapterIssue[]>;
  publish(input: PublishInput, ctx: AdapterContext): Promise<PublishResult>;
  /** For surfaces that finish asynchronously. */
  poll?(params: { externalId: string; channel: ChannelRuntime }, ctx: AdapterContext): Promise<PublishResult>;
  /** Confirms a post still exists. Reddit's silent removal is why this exists. */
  verify?(params: { externalUrl: string; channel: ChannelRuntime }): Promise<{ stillLive: boolean }>;
  remove?(params: { externalId: string; channel: ChannelRuntime }, ctx: AdapterContext): Promise<void>;
  oauth?: {
    authorizeUrl(state: string, redirectUri: string): string;
    exchangeCode(code: string, redirectUri: string): Promise<StoredCredentials>;
    refresh(creds: StoredCredentials): Promise<StoredCredentials>;
  };
}
