/**
 * Row and DTO shapes for the social engine.
 *
 * Mirrors migration 143. Kept separate from platforms.ts so the rules table stays readable, and
 * free of `next/*` and `@/` so the publish worker can import it by relative path.
 */
import type { PlatformId, SocialLang, SurfaceId } from "./platforms";

// ---------------------------------------------------------------------------
// Generated content
// ---------------------------------------------------------------------------

/**
 * A surface's fields, keyed by `FieldRule.key`.
 *
 * Deliberately loose: the field set is defined per surface in platforms.ts, not in the type
 * system, so adding a surface does not mean editing a union here. Values are strings, or arrays
 * for repeatable fields (thread tweets, carousel slides).
 */
export type SurfaceContent = Record<string, string | string[] | Record<string, string>[] | undefined>;

export type ClampAction = "clamped" | "rejected" | "warned";

export interface ClampViolation {
  field: string;
  lang?: SocialLang;
  limit: number;
  was: number;
  action: ClampAction;
  note?: string;
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export type BriefSourceType = "video_render" | "post" | "product" | "newsletter" | "topic" | "legacy_pack";

export type BriefStatus = "draft" | "generating" | "ready" | "archived";

export interface SocialBriefRow {
  id: string;
  sourceType: BriefSourceType;
  renderId: string | null;
  postId: string | null;
  sourceRef: Record<string, unknown>;
  legacyPackId: string | null;
  title: string;
  summary: string | null;
  /** The verbatim facts handed to the model, frozen so a run stays reproducible after the
   * source content is edited — the same reasoning as `video_storyboards.content_snapshot`. */
  bodyContext: string | null;
  jlptLevel: string | null;
  contentType: string | null;
  /** Site-relative. UTM parameters are appended per platform at generation time, never stored. */
  linkPath: string | null;
  utmCampaign: string | null;
  status: BriefStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the generator is actually told about the thing being promoted. */
export interface SocialBriefFacts {
  title: string;
  summary: string | null;
  bodyContext: string | null;
  jlptLevel: string | null;
  contentType: string | null;
  /** Already UTM-tagged for the target platform. */
  linkUrl: string | null;
  /** e.g. "60s vertical video, 1080x1920, burned-in captions". */
  mediaSummary: string | null;
  sourceType: BriefSourceType;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export type VariantSource = "ai_generated" | "human_edited" | "regenerated" | "imported";
export type VariantApproval = "draft" | "approved" | "rejected";

export interface SocialVariantRow {
  id: string;
  briefId: string;
  platform: PlatformId;
  surface: SurfaceId;
  lang: SocialLang;
  version: number;
  source: VariantSource;
  content: SurfaceContent;
  hashtags: string[];
  media: { kind: string; url: string; mimeType?: string }[];
  clampReport: ClampViolation[];
  approvalStatus: VariantApproval;
  approvedBy: string | null;
  approvedAt: string | null;
  generationRunId: string | null;
  isCurrent: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export type AuthStatus = "never_connected" | "connected" | "expired" | "revoked" | "error";

/**
 * A channel as any API route or server component may see it.
 *
 * Read from the `social_channels_public` VIEW, which physically cannot contain
 * `credentials_sealed`. That is deliberate: the previous design relied on a comment saying
 * "never SELECT this column", and comments do not survive a hurried `SELECT *`.
 */
export interface SocialChannelPublic {
  id: string;
  platform: PlatformId;
  label: string;
  handle: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  scopes: string[] | null;
  tokenExpiresAt: string | null;
  authStatus: AuthStatus;
  authError: string | null;
  config: Record<string, unknown>;
  autoPostEnabled: boolean;
  autoPostBlockedReason: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  credentialsVersion: number;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Credentials as stored (decrypted). Shape varies per platform; adapters narrow it. */
export type StoredCredentials = Record<string, unknown>;

/** A channel plus its decrypted credentials. Only ever constructed server-side, in the worker
 * or an inline publish, by `getChannelRuntime()`. */
export interface ChannelRuntime extends SocialChannelPublic {
  credentials: StoredCredentials;
}

// ---------------------------------------------------------------------------
// Posts (one delivery to one channel)
// ---------------------------------------------------------------------------

export type PostStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "claimed"
  | "uploading"
  | "awaiting_manual"
  | "published"
  | "failed"
  | "cancelled"
  | "removed";

export type DeliveryMode = "manual" | "api";

export interface SocialPostRow {
  id: string;
  variantId: string;
  channelId: string;
  status: PostStatus;
  delivery: DeliveryMode;
  scheduledFor: string | null;
  attemptCount: number;
  maxAttempts: number;
  externalId: string | null;
  externalUrl: string | null;
  externalState: string | null;
  /** Resumable-upload bookkeeping. Reusing the session URL after a crash is what makes a
   * YouTube retry idempotent instead of producing a second video. */
  uploadSessionUrl: string | null;
  uploadOffset: number;
  postedBy: string | null;
  publishedAt: string | null;
  /** A later re-fetch confirmed the post still exists. Reddit reports success and then silently
   * removes, so a `published` row that was never verified is only a claim. */
  verifiedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Generation runs
// ---------------------------------------------------------------------------

export type GenerationRunKind = "surface" | "repair" | "content_plan" | "plan_hint";
export type GenerationRunStatus = "ok" | "repaired" | "parse_failed" | "api_error" | "clamped";

export interface SocialGenerationRunInput {
  briefId: string | null;
  batchId: string | null;
  variantIds?: string[];
  kind: GenerationRunKind;
  surface: SurfaceId | null;
  langs: SocialLang[];
  model: string;
  promptKey: string | null;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
  status: GenerationRunStatus;
  errorMessage: string | null;
  durationMs: number | null;
  requestedBy: string | null;
}
