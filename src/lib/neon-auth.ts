import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL = process.env.NEON_AUTH_JWKS_URL;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) return null;
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return jwks;
}

/**
 * Verify a JWT issued by Neon Auth and return the payload (e.g. email).
 * Returns null if JWKS URL is not set or verification fails.
 */
export async function verifyNeonAuthToken(token: string): Promise<{ email: string } | null> {
  const keySet = getJwks();
  if (!keySet) return null;
  try {
    const { payload } = await jwtVerify(token, keySet);
    const email = payload.email as string;
    if (!email || typeof email !== "string") return null;
    return { email };
  } catch {
    return null;
  }
}
