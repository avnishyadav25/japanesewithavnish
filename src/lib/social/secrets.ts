/**
 * Sealed storage for OAuth tokens.
 *
 * Neon encrypts at rest, which protects against someone walking off with a disk. It does not
 * protect against a database dump landing somewhere it shouldn't — and a leaked refresh token is
 * a live handle on the YouTube channel, not just a password to rotate.
 *
 * So `social_channels.credentials_sealed` holds an AES-256-GCM envelope keyed on
 * `SOCIAL_TOKEN_KEY`, which lives in the environment and never in the database. GCM is
 * authenticated: a tampered ciphertext fails to open rather than decrypting to garbage.
 *
 * Envelope format: `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`. Versioned so the algorithm can be
 * changed later without guessing at what old rows contain.
 *
 * node:crypto only — no `next/*`, no `@/` alias. The publish worker imports this by relative
 * path under plain tsx.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const KEY_BYTES = 32;

function readKey(): Buffer | null {
  const raw = process.env.SOCIAL_TOKEN_KEY?.trim();
  if (!raw) return null;

  // Accept base64 or hex, since both are things a person plausibly pastes into an env var.
  let key: Buffer;
  try {
    key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  return key.length === KEY_BYTES ? key : null;
}

/**
 * Whether sealing is available.
 *
 * Checked at startup by anything that might need to publish, so a missing key surfaces as
 * "connect a channel and you'll be told" rather than as a decrypt error three steps into an
 * upload. Generate one with: `openssl rand -base64 32`
 */
export function socialCryptoConfigured(): boolean {
  return readKey() !== null;
}

function requireKey(): Buffer {
  const key = readKey();
  if (!key) {
    throw new Error(
      "SOCIAL_TOKEN_KEY is missing or not 32 bytes. Generate one with `openssl rand -base64 32` " +
        "and set it in .env.local AND in the GitHub Actions secrets the publish worker runs with — " +
        "if only the app has it, the worker will fail to publish while the admin UI looks healthy."
    );
  }
  return key;
}

export function sealSecret(value: unknown): string {
  const key = requireKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function openSecret(sealed: string): unknown {
  const key = requireKey();
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`Unrecognised credential envelope (expected ${VERSION}.iv.tag.ct)`);
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

/** Never log a token, but "which fields does this channel actually hold" is worth being able to
 * see when debugging an auth failure. */
export function describeSealed(sealed: string | null): string {
  if (!sealed) return "none";
  try {
    const opened = openSecret(sealed);
    if (opened && typeof opened === "object") return `${Object.keys(opened).sort().join(", ")}`;
    return typeof opened;
  } catch (err) {
    return `unreadable (${err instanceof Error ? err.message : "unknown"})`;
  }
}
