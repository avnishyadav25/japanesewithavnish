import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = process.env.ACCESS_TOKEN_SECRET || "fallback-change-in-production";
const SECRET_KEY = new TextEncoder().encode(SECRET);
const COOKIE_NAME = "auth_session";
const EXPIRY_HOURS = 24 * 7; // 7 days

export async function createSessionToken(email: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_HOURS * 60 * 60;
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const email = payload.email as string;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

const RESET_EXPIRY_HOURS = 1;

/** Short-lived JWT for password reset. Payload: { email, type: "reset" }. */
export async function createResetToken(email: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + RESET_EXPIRY_HOURS * 60 * 60;
  return new SignJWT({ email, type: "reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(SECRET_KEY);
}

/** Verify reset token; returns email only if valid and type is "reset". */
export async function verifyResetToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.type !== "reset") return null;
    const email = payload.email as string;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ email: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}
