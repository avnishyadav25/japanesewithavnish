import { SignJWT, jwtVerify } from "jose";

const SECRET = process.env.ACCESS_TOKEN_SECRET || "fallback-change-in-production";
const SECRET_KEY = new TextEncoder().encode(SECRET);
const EXPIRY_DAYS = 30;

export interface AccessTokenPayload {
  email: string;
  orderId: string;
  exp: number;
}

export async function createAccessToken(email: string, orderId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 60 * 60;
  const jwt = await new SignJWT({ email, orderId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(SECRET_KEY);
  return jwt;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const email = payload.email as string;
    const orderId = payload.orderId as string;
    if (!email || !orderId) return null;
    return { email, orderId, exp: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}
