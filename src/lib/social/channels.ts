/**
 * Channels — one account per platform, and the only place credentials are touched.
 *
 * THE RULE: every read that can reach an API response goes through `social_channels_public`, a
 * view that physically cannot contain `credentials_sealed`. Exactly one function here
 * (`getChannelRuntime`) reads the base table, and it is used by the publish path only.
 *
 * That is deliberately structural rather than conventional. The previous design for this — on
 * `video_publish_targets` — relied on a comment saying "never SELECT this column", and a comment
 * does not survive a hurried `SELECT *` written at speed six months later.
 */
import { sql } from "@/lib/db";
import { openSecret, sealSecret, socialCryptoConfigured } from "./secrets";
import type { PlatformId } from "./platforms";
import type { AuthStatus, ChannelRuntime, SocialChannelPublic, StoredCredentials } from "./types";

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new Error("Database unavailable");
  return sql;
}

type Row = Record<string, unknown>;

function toPublic(r: Row): SocialChannelPublic {
  return {
    id: String(r.id),
    platform: r.platform as PlatformId,
    label: String(r.label),
    handle: (r.handle as string) ?? null,
    externalAccountId: (r.external_account_id as string) ?? null,
    externalAccountName: (r.external_account_name as string) ?? null,
    scopes: (r.scopes as string[]) ?? null,
    tokenExpiresAt: (r.token_expires_at as string) ?? null,
    authStatus: r.auth_status as AuthStatus,
    authError: (r.auth_error as string) ?? null,
    config: (r.config as Record<string, unknown>) ?? {},
    autoPostEnabled: Boolean(r.auto_post_enabled),
    autoPostBlockedReason: (r.auto_post_blocked_reason as string) ?? null,
    isEnabled: Boolean(r.is_enabled),
    isDefault: Boolean(r.is_default),
    credentialsVersion: Number(r.credentials_version ?? 0),
    hasCredentials: Boolean(r.has_credentials),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listChannels(): Promise<SocialChannelPublic[]> {
  const db = requireSql();
  const rows = (await db`SELECT * FROM social_channels_public ORDER BY platform, label`) as Row[];
  return rows.map(toPublic);
}

export async function getChannel(id: string): Promise<SocialChannelPublic | null> {
  const db = requireSql();
  const rows = (await db`SELECT * FROM social_channels_public WHERE id = ${id}`) as Row[];
  return rows.length > 0 ? toPublic(rows[0]) : null;
}

export async function defaultChannelFor(platform: PlatformId): Promise<SocialChannelPublic | null> {
  const db = requireSql();
  const rows = (await db`
    SELECT * FROM social_channels_public
    WHERE platform = ${platform} AND is_enabled
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `) as Row[];
  return rows.length > 0 ? toPublic(rows[0]) : null;
}

export async function updateChannel(
  id: string,
  patch: { label?: string; handle?: string | null; config?: Record<string, unknown>; isEnabled?: boolean; autoPostEnabled?: boolean }
): Promise<SocialChannelPublic | null> {
  const db = requireSql();
  await db`
    UPDATE social_channels
       SET label            = COALESCE(${patch.label ?? null}, label),
           handle           = COALESCE(${patch.handle ?? null}, handle),
           config           = COALESCE(${patch.config ? JSON.stringify(patch.config) : null}::jsonb, config),
           is_enabled       = COALESCE(${patch.isEnabled ?? null}, is_enabled),
           auto_post_enabled = COALESCE(${patch.autoPostEnabled ?? null}, auto_post_enabled),
           updated_at       = NOW()
     WHERE id = ${id}
  `;
  return getChannel(id);
}

// ---------------------------------------------------------------------------
// Credentials — server-only from here down
// ---------------------------------------------------------------------------

/**
 * A channel plus its decrypted credentials.
 *
 * SERVER ONLY, and only on the publish path. Never return this from a route handler, never pass
 * it to a client component, never log it.
 */
export async function getChannelRuntime(id: string): Promise<ChannelRuntime> {
  const db = requireSql();
  const rows = (await db`
    SELECT c.*, (c.credentials_sealed IS NOT NULL) AS has_credentials
    FROM social_channels c WHERE c.id = ${id}
  `) as Row[];
  if (rows.length === 0) throw new Error("Channel not found");

  const base = toPublic(rows[0]);
  const sealed = rows[0].credentials_sealed as string | null;
  if (!sealed) return { ...base, credentials: {} };

  if (!socialCryptoConfigured()) {
    throw new Error(
      `Channel "${base.label}" has stored credentials but SOCIAL_TOKEN_KEY is not set in this ` +
        `environment. If the app can publish and the worker cannot, this is why — the key has to ` +
        `exist in the GitHub Actions secrets too.`
    );
  }

  return { ...base, credentials: (openSecret(sealed) as StoredCredentials) ?? {} };
}

export interface SaveCredentialsInput {
  channelId: string;
  credentials: StoredCredentials;
  expectedVersion: number;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  scopes?: string[] | null;
  tokenExpiresAt?: string | null;
}

/**
 * Stores credentials under a compare-and-swap on `credentials_version`.
 *
 * Two concurrent publishes to the same channel can both decide the access token is stale and
 * both refresh it; whichever writes second would otherwise invalidate the token the first is
 * already using. The Neon HTTP driver has no session state, so `pg_advisory_lock` is not
 * reliably available to the worker — a version CAS is, and it fails loudly instead of silently
 * clobbering.
 */
export async function saveChannelCredentials(
  input: SaveCredentialsInput
): Promise<{ ok: boolean; version: number }> {
  const db = requireSql();
  const sealed = sealSecret(input.credentials);

  const rows = (await db`
    UPDATE social_channels
       SET credentials_sealed    = ${sealed},
           credentials_version   = credentials_version + 1,
           external_account_id   = COALESCE(${input.externalAccountId ?? null}, external_account_id),
           external_account_name = COALESCE(${input.externalAccountName ?? null}, external_account_name),
           scopes                = COALESCE(${input.scopes ?? null}, scopes),
           token_expires_at      = COALESCE(${input.tokenExpiresAt ?? null}::timestamptz, token_expires_at),
           auth_status           = 'connected',
           auth_error            = NULL,
           updated_at            = NOW()
     WHERE id = ${input.channelId} AND credentials_version = ${input.expectedVersion}
    RETURNING credentials_version
  `) as Row[];

  if (rows.length === 0) {
    // Someone else wrote first. The caller must re-read rather than retry blindly.
    const current = (await db`SELECT credentials_version FROM social_channels WHERE id = ${input.channelId}`) as Row[];
    return { ok: false, version: Number(current[0]?.credentials_version ?? -1) };
  }
  return { ok: true, version: Number(rows[0].credentials_version) };
}

export async function markChannelAuthError(id: string, status: AuthStatus, message: string): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE social_channels SET auth_status = ${status}, auth_error = ${message}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function disconnectChannel(id: string): Promise<void> {
  const db = requireSql();
  await db`
    UPDATE social_channels
       SET credentials_sealed = NULL,
           credentials_version = credentials_version + 1,
           auth_status = 'revoked',
           auth_error = NULL,
           token_expires_at = NULL,
           scopes = NULL,
           -- Turning auto-post off with the credentials is the safe default: leaving it on
           -- would queue posts against a channel that can no longer publish them.
           auto_post_enabled = false,
           updated_at = NOW()
     WHERE id = ${id}
  `;
}
